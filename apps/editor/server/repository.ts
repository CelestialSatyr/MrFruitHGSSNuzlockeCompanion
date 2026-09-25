import { cp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { format, resolveConfig } from "prettier";
import {
  RunSeriesSchema,
  parseRunDataset,
  parseRunSeries,
  validateRunDatasetSemantics,
  type RunDataset,
  type RunSeries,
  type SemanticValidationIssue,
} from "@nuzlocke/core";
import { hgssGameStateAdapter } from "@nuzlocke/hgss";
import type {
  EditorBackupSummary,
  EditorPublishedSummary,
  EditorValidationSummary,
  EntityDiffSummary,
  PublishDiffResponse,
} from "../shared/api-types.ts";

export interface EditorPaths {
  repoRoot: string;
  publishedRoot: string;
  publishedSeriesPath: string;
  draftPath: string;
  legacyDraftPath: string;
  backupsRoot: string;
}

export function createEditorPaths(repoRoot: string): EditorPaths {
  return {
    repoRoot,
    publishedRoot: path.join(repoRoot, "content", "published"),
    publishedSeriesPath: path.join(repoRoot, "content", "published", "series.json"),
    draftPath: path.join(repoRoot, ".local", "drafts", "run-series.json"),
    legacyDraftPath: path.join(repoRoot, ".local", "drafts", "run-dataset.json"),
    backupsRoot: path.join(repoRoot, ".local", "backups"),
  };
}

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, "utf8")) as unknown;
}

function applyKnownRunMigrations(dataset: RunDataset): RunDataset {
  const players = dataset.players.map((player) =>
    player.id === "player_partner" && player.displayName === "Soul Link Partner"
      ? { ...player, displayName: "BlueWestlo", shortName: "Blue" }
      : player,
  );
  return players.some((player, index) => player !== dataset.players[index])
    ? parseRunDataset({ ...dataset, players })
    : dataset;
}

function applyKnownSeriesMigrations(series: RunSeries): RunSeries {
  const runs = series.runs.map(applyKnownRunMigrations);
  return parseRunSeries({ ...series, runs });
}

async function readLegacyDatasetFromRoot(root: string): Promise<RunDataset> {
  const [run, players, rules, tags, episodes, pokemon, soulLinks, events] = await Promise.all([
    readJson(path.join(root, "run.json")),
    readJson(path.join(root, "players.json")),
    readJson(path.join(root, "rules.json")),
    readJson(path.join(root, "tags.json")),
    readJson(path.join(root, "episodes", "index.json")),
    readJson(path.join(root, "pokemon", "index.json")),
    readJson(path.join(root, "soul-links", "index.json")),
    readJson(path.join(root, "events", "index.json")),
  ]);
  return applyKnownRunMigrations(
    parseRunDataset({ run, players, rules, tags, episodes, pokemon, soulLinks, events }),
  );
}

function wrapLegacyDataset(dataset: RunDataset): RunSeries {
  const title = dataset.run.title;
  return parseRunSeries({
    schemaVersion: 1,
    id: dataset.run.id,
    title,
    runs: [{ ...dataset, run: { ...dataset.run, attemptNumber: dataset.run.attemptNumber ?? 1 } }],
  });
}

async function readSeriesFromRoot(root: string): Promise<RunSeries> {
  try {
    return applyKnownSeriesMigrations(
      parseRunSeries(await readJson(path.join(root, "series.json"))),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return wrapLegacyDataset(await readLegacyDatasetFromRoot(root));
  }
}

export async function readPublishedSeries(paths: EditorPaths): Promise<RunSeries> {
  return readSeriesFromRoot(paths.publishedRoot);
}

export async function readOrCreateDraft(
  paths: EditorPaths,
): Promise<{ dataset: RunSeries; existed: boolean }> {
  try {
    return {
      dataset: applyKnownSeriesMigrations(parseRunSeries(await readJson(paths.draftPath))),
      existed: true,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  try {
    const legacy = applyKnownRunMigrations(parseRunDataset(await readJson(paths.legacyDraftPath)));
    const dataset = wrapLegacyDataset(legacy);
    await writeDraftSeries(paths, dataset);
    return { dataset, existed: true };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const dataset = await readPublishedSeries(paths);
  await writeDraftSeries(paths, dataset);
  return { dataset, existed: false };
}

export async function writeDraftSeries(paths: EditorPaths, input: unknown): Promise<RunSeries> {
  const series = parseRunSeries(input);
  await writeJson(paths.draftPath, series);
  return series;
}

export function validateSeries(input: unknown): EditorValidationSummary {
  const schema = RunSeriesSchema.safeParse(input);
  if (!schema.success) {
    return {
      valid: false,
      schemaIssues: schema.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
      semanticIssues: [],
    };
  }

  const semanticIssues: SemanticValidationIssue[] = [];
  for (const dataset of schema.data.runs) {
    const result = validateRunDatasetSemantics(dataset, hgssGameStateAdapter);
    for (const issue of result.issues) {
      semanticIssues.push({
        ...issue,
        message: `[${dataset.run.title}] ${issue.message}`,
      });
    }
  }

  return {
    valid: !semanticIssues.some((issue) => issue.severity === "error"),
    schemaIssues: [],
    semanticIssues,
  };
}

export function createPublicDataset(dataset: RunDataset): RunDataset {
  const episodes = dataset.episodes.filter((episode) => episode.status === "published");
  const episodeIds = new Set(episodes.map((episode) => episode.id));
  const events = dataset.events.filter((event) => episodeIds.has(event.episodeId));
  const eventIds = new Set(events.map((event) => event.id));
  const pokemon = dataset.pokemon.filter((entry) => eventIds.has(entry.createdByEventId));
  const pokemonIds = new Set(pokemon.map((entry) => entry.id));
  const soulLinks = dataset.soulLinks.filter(
    (link) =>
      eventIds.has(link.createdByEventId) && link.pokemonIds.every((id) => pokemonIds.has(id)),
  );

  const hasDraftEpisodes = dataset.episodes.some((episode) => episode.status === "draft");
  const terminalStatus = ["failed", "abandoned", "complete"].includes(dataset.run.status);
  const run = { ...dataset.run };
  if (hasDraftEpisodes && terminalStatus) {
    run.status = "active";
    delete run.completedAt;
  }

  const latestPublishedEpisode = episodes.reduce(
    (latest, episode) => Math.max(latest, episode.number),
    0,
  );

  /*
   * A planning run has no published episodes yet, but its initial
   * ruleset still belongs to the public pre-run companion.
   *
   * Treat planning as visible through Episode 1 for rule-version
   * filtering only. This exposes the starting rules without exposing
   * any later rule changes.
   */
  const publicRuleCutoff =
    latestPublishedEpisode > 0 ? latestPublishedEpisode : run.status === "planning" ? 1 : 0;
  const rules = dataset.rules.flatMap((rule) => {
    const versions = rule.versions.filter(
      (version) => version.effectiveFromEpisode <= publicRuleCutoff,
    );
    return versions.length ? [{ ...rule, versions }] : [];
  });
  const publicTagIds = new Set(
    events.flatMap((event) => event.tags?.map((assignment) => assignment.tagId) ?? []),
  );
  const tags = dataset.tags.filter((tag) => publicTagIds.has(tag.id));

  return parseRunDataset({
    run,
    players: dataset.players,
    rules,
    tags,
    episodes,
    pokemon,
    soulLinks,
    events,
  });
}

export function createPublicSeries(series: RunSeries): RunSeries {
  const publicRuns = series.runs.map(createPublicDataset);
  const runsWithPublishedEpisodes = publicRuns.filter((dataset) => dataset.episodes.length > 0);

  /*
   * Normal publication behaviour:
   *
   * Once the series has public episodes, only runs with at least
   * one published episode are exposed. This keeps future/draft-only
   * attempts hidden.
   */
  if (runsWithPublishedEpisodes.length > 0) {
    return parseRunSeries({
      ...series,
      runs: runsWithPublishedEpisodes,
    });
  }

  /*
   * Pre-run publication behaviour:
   *
   * Before Episode 1 exists, allow the first planning run to be
   * published so player profiles, initial rules and run metadata
   * can be live on the site.
   */
  const planningRun = publicRuns.find((dataset) => dataset.run.status === "planning");

  if (!planningRun) {
    throw new Error(
      "A series with no published episodes needs a planning run before it can be published.",
    );
  }

  return parseRunSeries({
    ...series,
    runs: [planningRun],
  });
}

function publishedSummary(series: RunSeries): EditorPublishedSummary {
  return {
    runCount: series.runs.length,
    episodeCount: series.runs.reduce((count, dataset) => count + dataset.episodes.length, 0),
    eventCount: series.runs.reduce((count, dataset) => count + dataset.events.length, 0),
    pokemonCount: series.runs.reduce((count, dataset) => count + dataset.pokemon.length, 0),
    soulLinkCount: series.runs.reduce((count, dataset) => count + dataset.soulLinks.length, 0),
  };
}

function stableValue(value: unknown): string {
  return JSON.stringify(value);
}

function seriesMetadata(series: RunSeries) {
  const { runs: _runs, ...metadata } = series;
  return metadata;
}

function diffById<T extends { id: string }>(
  current: readonly T[],
  next: readonly T[],
): EntityDiffSummary {
  const currentById = new Map(current.map((entry) => [entry.id, entry]));
  const nextById = new Map(next.map((entry) => [entry.id, entry]));
  const added: string[] = [];
  const changed: string[] = [];
  const removed: string[] = [];

  for (const [id, entry] of nextById) {
    const previous = currentById.get(id);
    if (!previous) added.push(id);
    else if (stableValue(previous) !== stableValue(entry)) changed.push(id);
  }
  for (const id of currentById.keys()) {
    if (!nextById.has(id)) removed.push(id);
  }

  return { added: added.sort(), changed: changed.sort(), removed: removed.sort() };
}

function flatten<T>(series: RunSeries, selector: (dataset: RunDataset) => readonly T[]): T[] {
  return series.runs.flatMap((dataset) => [...selector(dataset)]);
}

export function createPublishDiff(
  currentPublished: RunSeries,
  nextPublic: RunSeries,
): PublishDiffResponse {
  return {
    publicDataset: publishedSummary(nextPublic),
    seriesChanged:
      stableValue(seriesMetadata(currentPublished)) !== stableValue(seriesMetadata(nextPublic)),
    runs: diffById(
      currentPublished.runs.map((dataset) => dataset.run),
      nextPublic.runs.map((dataset) => dataset.run),
    ),
    episodes: diffById(
      flatten(currentPublished, (dataset) => dataset.episodes),
      flatten(nextPublic, (dataset) => dataset.episodes),
    ),
    events: diffById(
      flatten(currentPublished, (dataset) => dataset.events),
      flatten(nextPublic, (dataset) => dataset.events),
    ),
    pokemon: diffById(
      flatten(currentPublished, (dataset) => dataset.pokemon),
      flatten(nextPublic, (dataset) => dataset.pokemon),
    ),
    soulLinks: diffById(
      flatten(currentPublished, (dataset) => dataset.soulLinks),
      flatten(nextPublic, (dataset) => dataset.soulLinks),
    ),
    rules: diffById(
      currentPublished.runs.flatMap((dataset) =>
        dataset.rules.map((rule) => ({ ...rule, id: `${dataset.run.id}::${rule.id}` })),
      ),
      nextPublic.runs.flatMap((dataset) =>
        dataset.rules.map((rule) => ({ ...rule, id: `${dataset.run.id}::${rule.id}` })),
      ),
    ),
    tags: diffById(
      currentPublished.runs.flatMap((dataset) =>
        dataset.tags.map((tag) => ({ ...tag, id: `${dataset.run.id}::${tag.id}` })),
      ),
      nextPublic.runs.flatMap((dataset) =>
        dataset.tags.map((tag) => ({ ...tag, id: `${dataset.run.id}::${tag.id}` })),
      ),
    ),
  };
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });

  const prettierConfig = (await resolveConfig(filePath)) ?? {};
  const formatted = await format(JSON.stringify(value), {
    ...prettierConfig,
    filepath: filePath,
    parser: "json",
  });

  await writeFile(filePath, formatted, "utf8");
}

export async function backupPublishedDataset(paths: EditorPaths): Promise<string> {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const destination = path.join(paths.backupsRoot, stamp, "published");
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(paths.publishedRoot, destination, { recursive: true });
  return destination;
}

function parseBackupDate(id: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/.exec(id);
  if (!match) return id;
  return `${match[1]}T${match[2]}:${match[3]}:${match[4]}.${match[5]}Z`;
}

function assertBackupId(backupId: string): void {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/.test(backupId)) {
    throw new Error("Invalid backup identifier.");
  }
}

export async function listPublishedBackups(paths: EditorPaths): Promise<EditorBackupSummary[]> {
  let entries: string[];
  try {
    entries = (await readdir(paths.backupsRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const backups = await Promise.all(
    entries.map(async (id): Promise<EditorBackupSummary | undefined> => {
      try {
        assertBackupId(id);
        const series = await readSeriesFromRoot(path.join(paths.backupsRoot, id, "published"));
        return { id, createdAt: parseBackupDate(id), ...publishedSummary(series) };
      } catch {
        return undefined;
      }
    }),
  );

  return backups
    .filter((entry): entry is EditorBackupSummary => entry !== undefined)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function restoreBackupIntoDraft(
  paths: EditorPaths,
  backupId: string,
): Promise<RunSeries> {
  assertBackupId(backupId);
  const root = path.join(paths.backupsRoot, backupId, "published");
  return writeDraftSeries(paths, await readSeriesFromRoot(root));
}

export async function writePublishedSeries(paths: EditorPaths, series: RunSeries) {
  await writeJson(paths.publishedSeriesPath, series);

  // Keep the legacy single-run files mirrored to the first run so older local tools/checkouts
  // remain readable while series.json is the canonical multi-run source.
  const firstRun = series.runs[0];
  if (!firstRun) return;
  await Promise.all([
    writeJson(path.join(paths.publishedRoot, "run.json"), firstRun.run),
    writeJson(path.join(paths.publishedRoot, "players.json"), firstRun.players),
    writeJson(path.join(paths.publishedRoot, "rules.json"), firstRun.rules),
    writeJson(path.join(paths.publishedRoot, "tags.json"), firstRun.tags),
    writeJson(path.join(paths.publishedRoot, "episodes", "index.json"), firstRun.episodes),
    writeJson(path.join(paths.publishedRoot, "pokemon", "index.json"), firstRun.pokemon),
    writeJson(path.join(paths.publishedRoot, "soul-links", "index.json"), firstRun.soulLinks),
    writeJson(path.join(paths.publishedRoot, "events", "index.json"), firstRun.events),
  ]);
}
