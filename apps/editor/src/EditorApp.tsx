import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  parseRunDataset,
  parseRunSeries,
  type Episode,
  type EventTagDefinition,
  type Player,
  type Rule,
  type RuleCategory,
  type Run,
  type RunDataset,
  type RunSeries,
  type SiteNotice,
  type RunEvent,
  type RunStatus,
  type TagStyle,
} from "@nuzlocke/core";
import {
  GAME_LABEL,
  HGSS_BADGE_KEYS,
  HGSS_CAPABILITY_KEYS,
  HGSS_MAIN_STORY_LOCATIONS,
  HGSS_MILESTONE_KEYS,
  reconstructHgssRun,
} from "@nuzlocke/hgss";
import type {
  EditorBackupSummary,
  EditorBootstrapResponse,
  EditorValidationSummary,
  PokemonAbilityOption,
  PokemonSpeciesOption,
  PublishDiffResponse,
} from "../shared/api-types";
import {
  importYouTube,
  importYouTubeChannel,
  loadAbilityCatalog,
  loadBackups,
  loadEditorBootstrap,
  loadSpeciesCatalog,
  previewPublishDiff,
  publishDraft,
  resetDraft,
  restoreBackupToDraft,
  saveDraft,
  validateDraft,
} from "./editorApi";
import {
  addEventToDataset,
  deleteEventFromDataset,
  updateEventInDataset,
  type EventDraftInput,
  type EventIdPools,
} from "./lib/eventBuilder";
import {
  formatTimestampInput,
  nextEpisode,
  nextEventSequence,
  normalizeEpisodeEventOrder,
} from "./lib/editorData";

type Section =
  "overview" | "configuration" | "notice" | "library" | "episodes" | "events" | "publish";

const EVENT_TYPES = [
  { value: "encounter", label: "Encounter / capture" },
  { value: "evolution", label: "Evolution" },
  { value: "nickname-changed", label: "Nickname changed" },
  { value: "party-changed", label: "Party / box change" },
  { value: "level-milestone", label: "Level milestone" },
  { value: "move-changed", label: "Move changed" },
  { value: "held-item-changed", label: "Held item changed" },
  { value: "ability-changed", label: "Ability changed" },
  { value: "form-changed", label: "Form changed" },
  { value: "gym-battle", label: "Gym battle" },
  { value: "major-battle", label: "Major battle" },
  { value: "pokemon-death", label: "Pokémon death" },
  { value: "pokemon-revived", label: "Pokémon revived" },
  { value: "progression-changed", label: "Progression / capability" },
  { value: "special-moment", label: "Special moment" },
  { value: "rule-ruling", label: "Rule ruling" },
  { value: "custom", label: "Custom event" },
] satisfies ReadonlyArray<{ value: RunEvent["type"]; label: string }>;

const NATURES = [
  "hardy",
  "lonely",
  "brave",
  "adamant",
  "naughty",
  "bold",
  "docile",
  "relaxed",
  "impish",
  "lax",
  "timid",
  "hasty",
  "serious",
  "jolly",
  "naive",
  "modest",
  "mild",
  "quiet",
  "bashful",
  "rash",
  "calm",
  "gentle",
  "sassy",
  "careful",
  "quirky",
] as const;

const RUN_STATUSES: RunStatus[] = ["planning", "active", "failed", "abandoned", "complete"];
const RULE_CATEGORIES: RuleCategory[] = [
  "encounters",
  "soul-link",
  "deaths",
  "party",
  "items",
  "battle",
  "exceptions",
  "other",
];
const TAG_STYLES: TagStyle[] = ["celebration", "info", "warning", "rules", "fun", "historic"];
const PLAYER_GAMES = [
  { value: "heartgold", label: "HeartGold" },
  { value: "soulsilver", label: "SoulSilver" },
] as const;

const SITE_NOTICE_TYPES = [
  { value: "note", label: "Note" },
  { value: "info", label: "Information" },
  { value: "success", label: "Success" },
  { value: "warning", label: "Warning" },
  { value: "error", label: "Error" },
] satisfies ReadonlyArray<{ value: SiteNotice["type"]; label: string }>;

const DEFAULT_SITE_NOTICE: SiteNotice = {
  id: "site-notice",
  enabled: false,
  type: "note",
  message: "",
  dismissible: true,
};

const GYMS = [
  ["violet-gym", "Falkner", "zephyr"],
  ["azalea-gym", "Bugsy", "hive"],
  ["goldenrod-gym", "Whitney", "plain"],
  ["ecruteak-gym", "Morty", "fog"],
  ["cianwood-gym", "Chuck", "storm"],
  ["olivine-gym", "Jasmine", "mineral"],
  ["mahogany-gym", "Pryce", "glacier"],
  ["blackthorn-gym", "Clair", "rising"],
] as const;

function createEventForm(dataset: RunDataset): EventDraftInput {
  const episode = [...dataset.episodes].sort((a, b) => b.number - a.number)[0];
  const location = HGSS_MAIN_STORY_LOCATIONS[0];

  return {
    episodeId: episode?.id ?? "",
    sequence: episode ? nextEventSequence(dataset.events, episode.id) : 10,
    type: "encounter",
    timestamp: "",
    tone: "positive",
    importance: "normal",
    title: "",
    description: "",
    tagIds: [],
    annotations: [],
    pokemonIds: [],
    soulLinkIds: [],
    pokemonId: "",
    locationId: location?.id ?? "",
    opportunityId: location?.opportunities[0]?.id ?? "",
    acquisitionType: location?.opportunities[0]?.kind ?? "wild",
    left: {
      result: "caught",
      speciesId: "",
      nickname: "",
      level: "",
      placement: "party",
      gender: "unknown",
      shiny: false,
      natureId: "",
      abilityId: "",
      reason: "",
    },
    right: {
      result: "caught",
      speciesId: "",
      nickname: "",
      level: "",
      placement: "party",
      gender: "unknown",
      shiny: false,
      natureId: "",
      abilityId: "",
      reason: "",
    },
    fromSpeciesId: "",
    toSpeciesId: "",
    level: "",
    nickname: "",
    previousValue: "",
    nextValue: "",
    learnedMoveId: "",
    forgottenMoveId: "",
    destination: "party",
    reason: "",
    cause: "",
    opponentName: "",
    gymId: "violet-gym",
    leaderName: "Falkner",
    result: "win",
    badgeId: "zephyr",
    progressionKind: "milestone",
    progressionId: HGSS_MILESTONE_KEYS[0],
    progressionValue: true,
    ruleId: dataset.rules[0]?.id ?? "first-encounter",
    ruling: "violation",
  };
}

function eventToForm(dataset: RunDataset, event: RunEvent): EventDraftInput {
  const form = createEventForm(dataset);
  Object.assign(form, {
    episodeId: event.episodeId,
    sequence: event.sequence,
    type: event.type,
    timestamp: formatTimestampInput(event.videoTimestampSeconds),
    tone: event.tone,
    importance: event.importance,
    title: event.title ?? "",
    description: event.description ?? "",
    tagIds: event.tags?.map((tag) => tag.tagId) ?? [],
    annotations:
      event.annotations?.map((annotation) => ({
        kind: annotation.kind,
        text: annotation.text,
        ruleId: annotation.ruleId ?? "",
      })) ?? [],
  });

  switch (event.type) {
    case "encounter": {
      form.locationId = event.locationId;
      form.opportunityId = event.opportunityId;
      form.acquisitionType = event.acquisitionType;
      const players = dataset.run.playerIds;
      const mapSide = (
        playerId: string,
        fallback: EventDraftInput["left"],
      ): EventDraftInput["left"] => {
        const outcome = event.outcomes.find((entry) => entry.playerId === playerId);
        if (!outcome) return fallback;
        if (outcome.result !== "caught") {
          return {
            ...fallback,
            result: outcome.result,
            speciesId: outcome.speciesId ? String(outcome.speciesId) : "",
            reason: outcome.reason ?? "",
          };
        }
        const pokemon = dataset.pokemon.find((entry) => entry.id === outcome.pokemonId);
        return {
          ...fallback,
          result: "caught",
          speciesId: String(outcome.speciesId),
          nickname: outcome.nickname ?? "",
          level: outcome.level ? String(outcome.level) : "",
          placement: outcome.placement ?? "party",
          gender: pokemon?.gender ?? "unknown",
          shiny: pokemon?.shiny ?? false,
          natureId: pokemon?.natureId ?? "",
          abilityId: pokemon?.initialAbilityId ?? "",
        };
      };
      form.left = mapSide(players[0] ?? "", form.left);
      form.right = mapSide(players[1] ?? "", form.right);
      break;
    }
    case "evolution":
      form.pokemonId = event.pokemonId;
      form.fromSpeciesId = String(event.fromSpeciesId);
      form.toSpeciesId = String(event.toSpeciesId);
      form.level = event.level ? String(event.level) : "";
      break;
    case "nickname-changed":
      form.pokemonId = event.pokemonId;
      form.previousValue = event.fromNickname ?? "";
      form.nickname = event.toNickname;
      break;
    case "party-changed":
      form.pokemonIds = [...event.pokemonIds];
      form.destination = event.to;
      form.reason = event.reason ?? "";
      break;
    case "level-milestone":
      form.pokemonId = event.pokemonId;
      form.level = String(event.level);
      break;
    case "move-changed":
      form.pokemonId = event.pokemonId;
      form.learnedMoveId = event.learnedMoveId ?? "";
      form.forgottenMoveId = event.forgottenMoveId ?? "";
      break;
    case "held-item-changed":
      form.pokemonId = event.pokemonId;
      form.previousValue = event.fromItemId ?? "";
      form.nextValue = event.toItemId ?? "";
      break;
    case "ability-changed":
      form.pokemonId = event.pokemonId;
      form.previousValue = event.fromAbilityId ?? "";
      form.nextValue = event.toAbilityId;
      break;
    case "form-changed":
      form.pokemonId = event.pokemonId;
      form.previousValue = event.fromFormId ?? "";
      form.nextValue = event.toFormId;
      break;
    case "gym-battle":
      form.gymId = event.gymId;
      form.leaderName = event.leaderName;
      form.result = event.result;
      form.badgeId = event.badgeId ?? "";
      form.pokemonIds = [...event.participantPokemonIds];
      break;
    case "major-battle":
      form.title = event.battleName;
      form.result = event.result;
      form.pokemonIds = [...event.participantPokemonIds];
      break;
    case "pokemon-death":
      form.pokemonId = event.pokemonId;
      form.locationId = event.locationId ?? "";
      form.opponentName = event.opponentName ?? "";
      form.cause = event.cause;
      break;
    case "pokemon-revived":
      form.pokemonId = event.pokemonId;
      form.reason = event.reason;
      break;
    case "progression-changed":
      form.progressionKind = event.flag.kind;
      form.progressionId = event.flag.id;
      form.progressionValue = event.flag.value;
      break;
    case "special-moment":
      form.title = event.title;
      form.description = event.description;
      form.pokemonIds = [...(event.pokemonIds ?? [])];
      form.soulLinkIds = [...(event.soulLinkIds ?? [])];
      break;
    case "rule-ruling":
      form.ruleId = event.ruleId;
      form.ruling = event.ruling;
      form.description = event.details;
      break;
    case "custom":
      form.title = event.title;
      form.description = event.description;
      form.pokemonIds = [...(event.pokemonIds ?? [])];
      form.soulLinkIds = [...(event.soulLinkIds ?? [])];
      form.locationId = event.locationId ?? "";
      break;
  }

  return form;
}

function titleCase(value: string): string {
  return value
    .replaceAll("-", " ")
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string | undefined;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

function ValidationCard({ validation }: { validation: EditorValidationSummary }) {
  const errors = validation.semanticIssues.filter((issue) => issue.severity === "error");
  const warnings = validation.semanticIssues.filter((issue) => issue.severity === "warning");

  return (
    <section
      className={`validation-card ${validation.valid ? "validation-card--ok" : "validation-card--bad"}`}
    >
      <div>
        <strong>{validation.valid ? "Dataset valid" : "Validation needs attention"}</strong>
        <small>
          {errors.length} errors · {warnings.length} warnings · {validation.schemaIssues.length}{" "}
          schema issues
        </small>
      </div>
      {validation.schemaIssues.length || validation.semanticIssues.length ? (
        <details>
          <summary>Validation details</summary>
          <div className="validation-list">
            {validation.schemaIssues.map((issue, index) => (
              <p key={`s${index}`}>
                <b>schema</b> {issue.path || "dataset"}: {issue.message}
              </p>
            ))}
            {validation.semanticIssues.map((issue, index) => (
              <p key={`${issue.code}${index}`} className={`validation-${issue.severity}`}>
                <b>{issue.severity}</b> {issue.message}
              </p>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}

export function EditorApp() {
  const [bootstrap, setBootstrap] = useState<EditorBootstrapResponse | null>(null);
  const [series, setSeries] = useState<RunSeries | null>(null);
  const [activeRunId, setActiveRunId] = useState("");
  const [validation, setValidation] = useState<EditorValidationSummary | null>(null);
  const [section, setSection] = useState<Section>("overview");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void loadEditorBootstrap()
      .then((value) => {
        setBootstrap(value);
        setSeries(value.draft);
        setActiveRunId(value.draft.runs.at(-1)?.run.id ?? value.draft.runs[0]?.run.id ?? "");
        setValidation(value.validation);
      })
      .catch((value) => setError(value instanceof Error ? value.message : String(value)));
  }, []);

  const dataset = series?.runs.find((entry) => entry.run.id === activeRunId) ?? series?.runs[0];

  function mutate(update: (draft: RunDataset) => RunDataset) {
    if (!series || !dataset) return;
    const nextDataset = update(dataset);
    setSeries(
      parseRunSeries({
        ...series,
        runs: series.runs.map((entry) => (entry.run.id === dataset.run.id ? nextDataset : entry)),
      }),
    );
    setDirty(true);
    setMessage("");
  }

  function mutateSeries(update: (draft: RunSeries) => RunSeries) {
    setSeries((current) => (current ? update(current) : current));
    setDirty(true);
    setMessage("");
  }

  async function save(): Promise<boolean> {
    if (!series) return false;
    setBusy(true);
    setError("");
    try {
      const response = await saveDraft(series);
      setSeries(response.draft);
      setValidation(response.validation);
      setDirty(false);
      setMessage("Draft saved.");
      return true;
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function validate() {
    if (!series) return;
    setBusy(true);
    setError("");
    try {
      setValidation(await validateDraft(series));
      setMessage("Validation refreshed.");
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value));
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!confirm("Discard the local draft and restore published data for every run?")) return;
    setBusy(true);
    setError("");
    try {
      const response = await resetDraft();
      setSeries(response.draft);
      setActiveRunId(response.draft.runs.at(-1)?.run.id ?? response.draft.runs[0]?.run.id ?? "");
      setValidation(response.validation);
      setDirty(false);
      setMessage("Draft restored from published data.");
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value));
    } finally {
      setBusy(false);
    }
  }

  async function refreshWorkspaceStatus(): Promise<EditorBootstrapResponse | undefined> {
    try {
      const latest = await loadEditorBootstrap();
      setBootstrap(latest);
      return latest;
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value));
      return undefined;
    }
  }

  function applyRestoredDraft(restored: {
    draft: RunSeries;
    validation: EditorValidationSummary;
    restoredBackupId: string;
  }) {
    setSeries(restored.draft);
    setActiveRunId(restored.draft.runs.at(-1)?.run.id ?? restored.draft.runs[0]?.run.id ?? "");
    setValidation(restored.validation);
    setDirty(false);
    setMessage(
      `Backup ${restored.restoredBackupId} loaded into the local draft. Nothing public has changed yet.`,
    );
  }

  if (!dataset || !series || !bootstrap || !validation) {
    return (
      <main className="editor-loading">
        <h1>Nuzlocke Companion Editor</h1>
        <p>{error || "Loading local workspace…"}</p>
      </main>
    );
  }

  const sections: ReadonlyArray<{ value: Section; label: string }> = [
    { value: "overview", label: "Overview" },
    { value: "configuration", label: "Runs & Players" },
    { value: "notice", label: "Site Notice" },
    { value: "library", label: "Rules & Tags" },
    { value: "episodes", label: "Episodes" },
    { value: "events", label: "Events" },
    { value: "publish", label: "Preview & Publish" },
  ];
  const totalEpisodes = series.runs.reduce((count, run) => count + run.episodes.length, 0);
  const totalEvents = series.runs.reduce((count, run) => count + run.events.length, 0);
  const totalPokemon = series.runs.reduce((count, run) => count + run.pokemon.length, 0);
  const totalLinks = series.runs.reduce((count, run) => count + run.soulLinks.length, 0);

  return (
    <div className="editor-app">
      <header className="editor-topbar">
        <div>
          <p>Local authoring tool</p>
          <h1>Nuzlocke Companion Editor</h1>
        </div>
        <div className="editor-topbar__run">
          <span>Editing run</span>
          <select value={dataset.run.id} onChange={(event) => setActiveRunId(event.target.value)}>
            {series.runs.map((run) => (
              <option key={run.run.id} value={run.run.id}>
                {run.run.attemptNumber ? `Run ${run.run.attemptNumber} · ` : ""}
                {run.run.title}
              </option>
            ))}
          </select>
        </div>
        <div className="editor-topbar__actions">
          <span className={dirty ? "draft-state draft-state--dirty" : "draft-state"}>
            {dirty ? "Unsaved changes" : "Draft saved"}
          </span>
          <button onClick={() => void validate()} disabled={busy}>
            Validate
          </button>
          <button className="button-primary" onClick={() => void save()} disabled={busy || !dirty}>
            Save draft
          </button>
        </div>
      </header>

      <div className="editor-layout">
        <aside className="editor-sidebar">
          <div className="editor-brand">
            <strong>{GAME_LABEL}</strong>
            <small>
              {series.runs.length} run{series.runs.length === 1 ? "" : "s"} · Local only
            </small>
          </div>
          <nav>
            {sections.map((entry) => (
              <button
                key={entry.value}
                className={section === entry.value ? "active" : ""}
                onClick={() => setSection(entry.value)}
              >
                {entry.label}
              </button>
            ))}
          </nav>
          <div className="editor-sidebar__footer">
            <small>{totalEpisodes} episodes</small>
            <small>{totalEvents} events</small>
            <small>{totalPokemon} Pokémon</small>
            <small>{totalLinks} Soul Links</small>
          </div>
        </aside>

        <main className="editor-content">
          {error ? (
            <div className="editor-alert editor-alert--error">
              {error}
              <button onClick={() => setError("")}>×</button>
            </div>
          ) : null}
          {message ? <div className="editor-alert">{message}</div> : null}

          {section === "overview" ? (
            <Overview
              series={series}
              dataset={dataset}
              validation={validation}
              bootstrap={bootstrap}
              onReset={() => void reset()}
            />
          ) : null}
          {section === "configuration" ? (
            <Configuration
              series={series}
              dataset={dataset}
              mutate={mutate}
              mutateSeries={mutateSeries}
              activeRunId={dataset.run.id}
              setActiveRunId={setActiveRunId}
              youtubeConfigured={bootstrap.youtubeConfigured}
              setError={setError}
            />
          ) : null}
          {section === "notice" ? (
            <SiteNoticeEditor series={series} mutateSeries={mutateSeries} />
          ) : null}
          {section === "library" ? (
            <RulesAndTags key={dataset.run.id} dataset={dataset} mutate={mutate} />
          ) : null}
          {section === "episodes" ? (
            <Episodes
              key={dataset.run.id}
              series={series}
              dataset={dataset}
              youtubeConfigured={bootstrap.youtubeConfigured}
              mutate={mutate}
              setError={setError}
            />
          ) : null}
          {section === "events" ? (
            <Events
              key={dataset.run.id}
              series={series}
              dataset={dataset}
              mutate={mutate}
              setError={setError}
            />
          ) : null}
          {section === "publish" ? (
            <Publish
              series={series}
              validation={validation}
              bootstrap={bootstrap}
              dirty={dirty}
              save={save}
              setValidation={setValidation}
              setMessage={setMessage}
              setError={setError}
              onPublished={(published) =>
                setBootstrap((current) => (current ? { ...current, published } : current))
              }
              refreshWorkspaceStatus={refreshWorkspaceStatus}
              onRestoreDraft={applyRestoredDraft}
            />
          ) : null}
        </main>
      </div>
    </div>
  );
}

function Overview({
  series,
  dataset,
  validation,
  bootstrap,
  onReset,
}: {
  series: RunSeries;
  dataset: RunDataset;
  validation: EditorValidationSummary;
  bootstrap: EditorBootstrapResponse;
  onReset(): void;
}) {
  const publishedEpisodes = dataset.episodes.filter((episode) => episode.status === "published");
  const totalDraftEpisodes = series.runs.reduce(
    (count, run) => count + run.episodes.filter((episode) => episode.status === "draft").length,
    0,
  );

  return (
    <div className="editor-stack">
      <header className="editor-heading">
        <p>Series workspace</p>
        <h2>{series.title}</h2>
        <span>
          You are currently editing {dataset.run.title}. Future runs stay invisible on the public
          site until their first published episode passes the viewer's spoiler cutoff.
        </span>
      </header>

      <div className="metric-grid">
        <article>
          <span>Runs</span>
          <strong>{series.runs.length}</strong>
        </article>
        <article>
          <span>Draft episodes</span>
          <strong>{totalDraftEpisodes}</strong>
        </article>
        <article>
          <span>Events in this run</span>
          <strong>{dataset.events.length}</strong>
        </article>
        <article>
          <span>Soul Links in this run</span>
          <strong>{dataset.soulLinks.length}</strong>
        </article>
      </div>

      <ValidationCard validation={validation} />

      <section className="editor-card">
        <div className="card-heading">
          <div>
            <p>Active run</p>
            <h3>{dataset.run.title}</h3>
          </div>
        </div>
        <dl className="status-list">
          <div>
            <dt>Attempt</dt>
            <dd>{dataset.run.attemptNumber ?? "—"}</dd>
          </div>
          <div>
            <dt>Run status</dt>
            <dd>{titleCase(dataset.run.status)}</dd>
          </div>
          <div>
            <dt>Scope</dt>
            <dd>{titleCase(dataset.run.scope)}</dd>
          </div>
          <div>
            <dt>Published episodes in run</dt>
            <dd>{publishedEpisodes.map((episode) => episode.number).join(", ") || "None yet"}</dd>
          </div>
          <div>
            <dt>Players</dt>
            <dd>{dataset.players.map((player) => player.displayName).join(" / ")}</dd>
          </div>
        </dl>
      </section>

      <section className="editor-card">
        <div className="card-heading">
          <div>
            <p>Integrations</p>
            <h3>Local environment</h3>
          </div>
        </div>
        <dl className="status-list">
          <div>
            <dt>YouTube import</dt>
            <dd>{bootstrap.youtubeConfigured ? "Configured" : "Needs .env.local key"}</dd>
          </div>
          <div>
            <dt>Git</dt>
            <dd>
              {bootstrap.git.available ? bootstrap.git.branch || "Available" : "Not detected"}
            </dd>
          </div>
          <div>
            <dt>Remote</dt>
            <dd>{bootstrap.git.remote || "—"}</dd>
          </div>
          <div>
            <dt>Published baseline</dt>
            <dd>
              {bootstrap.published.runCount} runs / {bootstrap.published.episodeCount} episodes /{" "}
              {bootstrap.published.eventCount} events
            </dd>
          </div>
        </dl>
        {bootstrap.git.unrelatedDirtyPaths.length ? (
          <p className="warning-copy">
            Git publishing is blocked by unrelated changes:{" "}
            {bootstrap.git.unrelatedDirtyPaths.join(", ")}
          </p>
        ) : null}
      </section>

      <section className="editor-card danger-zone">
        <div>
          <h3>Reset draft</h3>
          <p>Replace every local run with the current public series.</p>
        </div>
        <button onClick={onReset}>Reset</button>
      </section>
    </div>
  );
}

function SiteNoticeEditor({
  series,
  mutateSeries,
}: {
  series: RunSeries;
  mutateSeries(fn: (draft: RunSeries) => RunSeries): void;
}) {
  const notice = series.siteNotice ?? DEFAULT_SITE_NOTICE;
  const typeLabel =
    SITE_NOTICE_TYPES.find((entry) => entry.value === notice.type)?.label ?? titleCase(notice.type);
  const previewIcon =
    notice.type === "success"
      ? "✓"
      : notice.type === "warning"
        ? "!"
        : notice.type === "error"
          ? "×"
          : "i";

  function patch(changes: Partial<SiteNotice>) {
    mutateSeries((draft) => {
      const nextNotice: SiteNotice = {
        ...(draft.siteNotice ?? DEFAULT_SITE_NOTICE),
        ...changes,
      };
      return { ...draft, siteNotice: nextNotice };
    });
  }

  function clearNotice() {
    mutateSeries((draft) => {
      const next = { ...draft };
      delete next.siteNotice;
      return next;
    });
  }

  return (
    <div className="editor-stack">
      <header className="editor-heading">
        <p>Site communication</p>
        <h2>Public notice banner</h2>
        <span>
          Publish one site-wide message above the navigation. Use it for schedule changes,
          corrections, warnings, updates, or other information that players and viewers should see.
        </span>
      </header>

      <section className="editor-card notice-editor">
        <div className="card-heading">
          <div>
            <p>Visibility</p>
            <h3>{notice.enabled ? "Banner enabled" : "Banner hidden"}</h3>
          </div>
          <button type="button" onClick={clearNotice} disabled={!series.siteNotice}>
            Clear notice
          </button>
        </div>

        <label className="check-field notice-editor__enabled">
          <input
            type="checkbox"
            checked={notice.enabled}
            onChange={(event) => patch({ enabled: event.target.checked })}
          />
          <span>
            <strong>Show this notice on the public website</strong>
            <small>
              Disabled notices stay in the draft so you can prepare or temporarily hide a message.
            </small>
          </span>
        </label>

        <div className="form-grid">
          <Field label="Banner type">
            <select
              value={notice.type}
              onChange={(event) => patch({ type: event.target.value as SiteNotice["type"] })}
            >
              {SITE_NOTICE_TYPES.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Title" hint="Optional. The banner type is still shown when this is blank.">
            <input
              value={notice.title ?? ""}
              placeholder="Schedule change"
              maxLength={120}
              onChange={(event) => patch({ title: event.target.value })}
            />
          </Field>
        </div>

        <Field
          label="Message"
          hint="Required while the banner is enabled. Maximum 1200 characters."
        >
          <textarea
            rows={5}
            maxLength={1200}
            value={notice.message}
            placeholder="Write the message that players and viewers should see…"
            onChange={(event) => patch({ message: event.target.value })}
          />
        </Field>

        <label className="check-field notice-editor__dismissible">
          <input
            type="checkbox"
            checked={notice.dismissible}
            onChange={(event) => patch({ dismissible: event.target.checked })}
          />
          <span>
            <strong>Visitors can dismiss this notice</strong>
            <small>
              A changed message is treated as a new notice, so previously dismissed visitors will
              see the updated version again.
            </small>
          </span>
        </label>

        <div className="form-grid">
          <Field
            label="Link label"
            hint="Optional. Defaults to “Learn more” when only a URL is set."
          >
            <input
              value={notice.linkLabel ?? ""}
              placeholder="Read more"
              maxLength={80}
              onChange={(event) => patch({ linkLabel: event.target.value })}
            />
          </Field>
          <Field label="Link URL" hint="Optional. Use /rules or a full http(s) URL.">
            <input
              value={notice.linkUrl ?? ""}
              placeholder="/rules"
              onChange={(event) => patch({ linkUrl: event.target.value })}
            />
          </Field>
        </div>
      </section>

      <section className="editor-card">
        <div className="card-heading">
          <div>
            <p>Preview</p>
            <h3>Public banner appearance</h3>
          </div>
          <span
            className={`notice-editor__state ${notice.enabled ? "notice-editor__state--enabled" : ""}`}
          >
            {notice.enabled ? "Will publish" : "Hidden"}
          </span>
        </div>

        <div className={`notice-preview notice-preview--${notice.type}`}>
          <span className="notice-preview__icon" aria-hidden="true">
            {previewIcon}
          </span>
          <div className="notice-preview__copy">
            <small>{typeLabel}</small>
            {notice.title?.trim() ? <strong>{notice.title}</strong> : null}
            <p>{notice.message.trim() || "Your site notice message will appear here."}</p>
            {notice.linkUrl?.trim() ? (
              <span className="notice-preview__link">
                {notice.linkLabel?.trim() || "Learn more"} →
              </span>
            ) : null}
          </div>
          {notice.dismissible ? (
            <span className="notice-preview__dismiss" aria-hidden="true">
              ×
            </span>
          ) : null}
        </div>

        {!notice.enabled ? (
          <p className="muted-copy notice-editor__preview-note">
            This preview is visible in the editor, but the banner is currently disabled on the site.
          </p>
        ) : null}
      </section>
    </div>
  );
}

function Configuration({
  series,
  dataset,
  mutate,
  mutateSeries,
  activeRunId,
  setActiveRunId,
  youtubeConfigured,
  setError,
}: {
  series: RunSeries;
  dataset: RunDataset;
  mutate(fn: (draft: RunDataset) => RunDataset): void;
  mutateSeries(fn: (draft: RunSeries) => RunSeries): void;
  activeRunId: string;
  setActiveRunId(value: string): void;
  youtubeConfigured: boolean;
  setError(value: string): void;
}) {
  const [syncingPlayerId, setSyncingPlayerId] = useState<string | null>(null);

  function updateRun(changes: Partial<Run>) {
    mutate((draft) => parseRunDataset({ ...draft, run: { ...draft.run, ...changes } }));
  }

  function optionalRunField(key: "description" | "startedAt" | "completedAt", value: string) {
    mutate((draft) => {
      const nextRun: Run = { ...draft.run };
      if (value.trim()) (nextRun as unknown as Record<string, unknown>)[key] = value.trim();
      else delete (nextRun as unknown as Record<string, unknown>)[key];
      return parseRunDataset({ ...draft, run: nextRun });
    });
  }

  function updatePlayer(playerId: string, changes: Partial<Player>) {
    mutate((draft) =>
      parseRunDataset({
        ...draft,
        players: draft.players.map((player) =>
          player.id === playerId ? { ...player, ...changes } : player,
        ),
      }),
    );
  }

  function optionalPlayerField(playerId: string, key: "shortName" | "channelUrl", value: string) {
    mutate((draft) => {
      const players = draft.players.map((player) => {
        if (player.id !== playerId) return player;
        const nextPlayer: Player = { ...player };
        if (value.trim()) (nextPlayer as unknown as Record<string, unknown>)[key] = value.trim();
        else delete (nextPlayer as unknown as Record<string, unknown>)[key];
        return nextPlayer;
      });
      return parseRunDataset({ ...draft, players });
    });
  }

  function createRun() {
    const attemptNumber = Math.max(0, ...series.runs.map((run) => run.run.attemptNumber ?? 0)) + 1;
    let runId = `run-${String(attemptNumber).padStart(2, "0")}`;
    let suffix = attemptNumber;
    while (series.runs.some((entry) => entry.run.id === runId)) {
      suffix += 1;
      runId = `run-${String(suffix).padStart(2, "0")}`;
    }

    const nextRun = parseRunDataset({
      run: {
        schemaVersion: 1,
        id: runId,
        title: `Run ${attemptNumber}`,
        gameId: dataset.run.gameId,
        status: "planning",
        attemptNumber,
        scope: dataset.run.scope,
        playerIds: [...dataset.run.playerIds],
        description: `Attempt ${attemptNumber} of ${series.title}.`,
      },
      players: dataset.players.map((player) => ({ ...player })),
      rules: dataset.rules.map((rule) => ({
        ...rule,
        versions: rule.versions.map((version) => ({ ...version })),
      })),
      tags: dataset.tags.map((tag) => ({ ...tag })),
      episodes: [],
      pokemon: [],
      soulLinks: [],
      events: [],
    });

    mutateSeries((draft) => parseRunSeries({ ...draft, runs: [...draft.runs, nextRun] }));
    setActiveRunId(runId);
  }

  function deleteRun() {
    if (series.runs.length <= 1) return;
    if (!confirm(`Delete ${dataset.run.title} and all of its local draft data?`)) return;
    const remaining = series.runs.filter((run) => run.run.id !== activeRunId);
    mutateSeries((draft) =>
      parseRunSeries({ ...draft, runs: draft.runs.filter((run) => run.run.id !== activeRunId) }),
    );
    setActiveRunId(remaining.at(-1)?.run.id ?? remaining[0]?.run.id ?? "");
  }

  async function syncChannel(player: Player) {
    if (!player.channelUrl) {
      setError(`Enter a YouTube channel URL for ${player.displayName} first.`);
      return;
    }
    setSyncingPlayerId(player.id);
    setError("");
    try {
      const profile = await importYouTubeChannel(player.channelUrl);
      updatePlayer(player.id, { channelUrl: profile.channelUrl, avatarUrl: profile.avatarUrl });
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value));
    } finally {
      setSyncingPlayerId(null);
    }
  }

  const runEpisodeNumbers = dataset.episodes.map((episode) => episode.number).sort((a, b) => a - b);

  return (
    <div className="editor-stack">
      <header className="editor-heading">
        <p>Configuration</p>
        <h2>Runs & player identities</h2>
        <span>
          Each attempt is its own event-sourced run. A later run only becomes visible publicly once
          the viewer's spoiler cutoff reaches that run's first published episode.
        </span>
      </header>

      <section className="editor-card">
        <div className="card-heading">
          <div>
            <p>Series</p>
            <h3>{series.title}</h3>
          </div>
          <button className="button-primary" onClick={createRun}>
            + New run
          </button>
        </div>
        <div className="form-grid">
          <Field label="Series title">
            <input
              value={series.title}
              onChange={(event) =>
                mutateSeries((draft) => parseRunSeries({ ...draft, title: event.target.value }))
              }
            />
          </Field>
          <Field label="Series ID" hint="Stable project identifier.">
            <input value={series.id} readOnly />
          </Field>
        </div>
        <div className="run-config-list">
          {series.runs.map((run) => {
            const numbers = run.episodes.map((episode) => episode.number).sort((a, b) => a - b);
            return (
              <button
                key={run.run.id}
                className={
                  run.run.id === activeRunId ? "run-config-card selected" : "run-config-card"
                }
                onClick={() => setActiveRunId(run.run.id)}
              >
                <span>
                  <strong>Run {run.run.attemptNumber ?? "?"}</strong>
                  <small>{run.run.title}</small>
                </span>
                <span>
                  <b>{titleCase(run.run.status)}</b>
                  <small>
                    {numbers.length
                      ? `Episodes ${numbers[0]}–${numbers.at(-1)}`
                      : "No episodes yet"}
                  </small>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="editor-card">
        <div className="card-heading">
          <div>
            <p>Run metadata</p>
            <h3>{dataset.run.title}</h3>
          </div>
          {series.runs.length > 1 ? <button onClick={deleteRun}>Delete run</button> : null}
        </div>
        <div className="form-grid form-grid--3">
          <Field label="Run title">
            <input
              value={dataset.run.title}
              onChange={(event) => updateRun({ title: event.target.value })}
            />
          </Field>
          <Field label="Attempt number">
            <input
              type="number"
              min="1"
              value={dataset.run.attemptNumber ?? 1}
              onChange={(event) => updateRun({ attemptNumber: Number(event.target.value) })}
            />
          </Field>
          <Field label="Status">
            <select
              value={dataset.run.status}
              onChange={(event) => {
                const status = event.target.value as RunStatus;
                updateRun(
                  ["complete", "failed", "abandoned"].includes(status) && !dataset.run.completedAt
                    ? { status, completedAt: new Date().toISOString() }
                    : { status },
                );
              }}
            >
              {RUN_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {titleCase(status)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="form-grid form-grid--3">
          <Field label="Run ID" hint="Stable identifier.">
            <input value={dataset.run.id} readOnly />
          </Field>
          <Field label="Scope">
            <select
              value={dataset.run.scope}
              onChange={(event) => updateRun({ scope: event.target.value as Run["scope"] })}
            >
              <option value="main-story">Main story</option>
              <option value="full-game">Full game</option>
            </select>
          </Field>
          <Field label="Episode range" hint="Derived from this run's episodes.">
            <input
              value={
                runEpisodeNumbers.length
                  ? `${runEpisodeNumbers[0]}–${runEpisodeNumbers.at(-1)}`
                  : "No episodes yet"
              }
              readOnly
            />
          </Field>
        </div>
        <div className="form-grid">
          <Field label="Started at" hint="Optional ISO date-time.">
            <input
              value={dataset.run.startedAt ?? ""}
              onChange={(event) => optionalRunField("startedAt", event.target.value)}
            />
          </Field>
          <Field label="Completed at" hint="Optional; useful for completed/failed attempts.">
            <input
              value={dataset.run.completedAt ?? ""}
              onChange={(event) => optionalRunField("completedAt", event.target.value)}
            />
          </Field>
        </div>
        <Field label="Description">
          <textarea
            rows={4}
            value={dataset.run.description ?? ""}
            onChange={(event) => optionalRunField("description", event.target.value)}
          />
        </Field>
      </section>

      <section className="editor-card">
        <div className="card-heading">
          <div>
            <p>Players</p>
            <h3>Displayed identities</h3>
          </div>
        </div>
        <p className="muted-copy">
          The avatar is imported from the YouTube channel URL and cached in the data. There is no
          separate avatar field to keep in sync.
        </p>
        <div className="config-player-grid">
          {dataset.players.map((player) => (
            <article key={player.id} className="config-player-card">
              <div className="player-config-heading">
                {player.avatarUrl ? (
                  <a href={player.channelUrl} target="_blank" rel="noreferrer">
                    <img src={player.avatarUrl} alt="" />
                  </a>
                ) : (
                  <span className="player-avatar-placeholder">?</span>
                )}
                <div>
                  <h4>{player.displayName}</h4>
                  <small>{player.id}</small>
                </div>
              </div>
              <div className="form-grid">
                <Field label="Display name">
                  <input
                    value={player.displayName}
                    onChange={(event) =>
                      updatePlayer(player.id, { displayName: event.target.value })
                    }
                  />
                </Field>
                <Field label="Short name">
                  <input
                    value={player.shortName ?? ""}
                    onChange={(event) =>
                      optionalPlayerField(player.id, "shortName", event.target.value)
                    }
                  />
                </Field>
              </div>
              <div className="form-grid">
                <Field label="Game version">
                  <select
                    value={player.gameVersionId}
                    onChange={(event) =>
                      updatePlayer(player.id, {
                        gameVersionId: event.target.value as Player["gameVersionId"],
                      })
                    }
                  >
                    {PLAYER_GAMES.map((game) => (
                      <option key={game.value} value={game.value}>
                        {game.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label="YouTube channel URL"
                  hint={
                    youtubeConfigured
                      ? "Use an @handle, /channel/UC… or /user/… URL, then sync."
                      : "Add YOUTUBE_API_KEY to .env.local to import the avatar."
                  }
                >
                  <div className="inline-control inline-control--field">
                    <input
                      value={player.channelUrl ?? ""}
                      placeholder="https://youtube.com/@..."
                      onChange={(event) =>
                        optionalPlayerField(player.id, "channelUrl", event.target.value)
                      }
                    />
                    <button
                      type="button"
                      disabled={!youtubeConfigured || syncingPlayerId === player.id}
                      onClick={() => void syncChannel(player)}
                    >
                      {syncingPlayerId === player.id ? "Syncing…" : "Sync profile"}
                    </button>
                  </div>
                </Field>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function RulesAndTags({
  dataset,
  mutate,
}: {
  dataset: RunDataset;
  mutate(fn: (draft: RunDataset) => RunDataset): void;
}) {
  const [selectedRuleId, setSelectedRuleId] = useState(dataset.rules[0]?.id ?? "");
  const [selectedTagId, setSelectedTagId] = useState(dataset.tags[0]?.id ?? "");

  const selectedRule = dataset.rules.find((rule) => rule.id === selectedRuleId) ?? dataset.rules[0];
  const selectedTag = dataset.tags.find((tag) => tag.id === selectedTagId) ?? dataset.tags[0];

  useEffect(() => {
    if (!selectedRuleId && dataset.rules[0]) setSelectedRuleId(dataset.rules[0].id);
  }, [dataset.rules, selectedRuleId]);
  useEffect(() => {
    if (!selectedTagId && dataset.tags[0]) setSelectedTagId(dataset.tags[0].id);
  }, [dataset.tags, selectedTagId]);

  function addRule() {
    const nextNumber = dataset.rules.length + 1;
    const rule: Rule = {
      id: `rule-${nextNumber}` as Rule["id"],
      title: `New Rule ${nextNumber}`,
      category: "other",
      shortSummary: "Add a concise rule summary.",
      versions: [
        {
          effectiveFromEpisode: 1,
          summary: "Initial version",
          description: "Describe the rule in detail.",
        },
      ],
    };
    mutate((draft) => parseRunDataset({ ...draft, rules: [...draft.rules, rule] }));
    setSelectedRuleId(rule.id);
  }

  function updateRule(ruleId: string, changes: Partial<Rule>) {
    mutate((draft) => {
      const nextRuleId = changes.id;
      return {
        ...draft,
        rules: draft.rules.map((rule) => {
          if (rule.id !== ruleId) return rule;
          return nextRuleId
            ? ({ ...rule, ...changes, id: nextRuleId } as Rule)
            : { ...rule, ...changes };
        }),
        events: nextRuleId
          ? draft.events.map((event) =>
              event.type === "rule-ruling" && event.ruleId === ruleId
                ? { ...event, ruleId: nextRuleId }
                : event,
            )
          : draft.events,
      } as RunDataset;
    });
    if (changes.id && changes.id !== ruleId) setSelectedRuleId(changes.id);
  }

  function updateRuleVersion(
    ruleId: string,
    index: number,
    changes: Partial<Rule["versions"][number]>,
  ) {
    mutate(
      (draft) =>
        ({
          ...draft,
          rules: draft.rules.map((rule) => {
            if (rule.id !== ruleId) return rule;
            const versions = rule.versions.map((version, versionIndex) =>
              versionIndex === index ? { ...version, ...changes } : version,
            );
            return { ...rule, versions };
          }),
        }) as RunDataset,
    );
  }

  function addRuleVersion(ruleId: string) {
    mutate((draft) =>
      parseRunDataset({
        ...draft,
        rules: draft.rules.map((rule) => {
          if (rule.id !== ruleId) return rule;
          const latest = rule.versions.at(-1);
          return {
            ...rule,
            versions: [
              ...rule.versions,
              {
                effectiveFromEpisode: latest ? latest.effectiveFromEpisode + 1 : 1,
                summary: "New version summary",
                description: "Describe how the rule changes here.",
              },
            ],
          };
        }),
      }),
    );
  }

  function deleteRuleVersion(ruleId: string, index: number) {
    mutate((draft) =>
      parseRunDataset({
        ...draft,
        rules: draft.rules.map((rule) => {
          if (rule.id !== ruleId || rule.versions.length <= 1) return rule;
          return {
            ...rule,
            versions: rule.versions.filter((_, versionIndex) => versionIndex !== index),
          };
        }),
      }),
    );
  }

  function deleteRule(ruleId: string) {
    if (
      !confirm(`Delete rule ${ruleId}? Rule-ruling events referencing it will need manual cleanup.`)
    )
      return;
    mutate((draft) =>
      parseRunDataset({ ...draft, rules: draft.rules.filter((rule) => rule.id !== ruleId) }),
    );
    setSelectedRuleId("");
  }

  function addTag() {
    const nextNumber = dataset.tags.length + 1;
    const tag: EventTagDefinition = {
      id: `tag-${nextNumber}` as EventTagDefinition["id"],
      label: `New Tag ${nextNumber}`,
      description: "Describe when this tag should be used.",
      style: "info",
    };
    mutate((draft) => parseRunDataset({ ...draft, tags: [...draft.tags, tag] }));
    setSelectedTagId(tag.id);
  }

  function updateTag(tagId: string, changes: Partial<EventTagDefinition>) {
    mutate((draft) => {
      const nextTagId = changes.id;
      return {
        ...draft,
        tags: draft.tags.map((tag) => {
          if (tag.id !== tagId) return tag;
          return nextTagId
            ? ({ ...tag, ...changes, id: nextTagId } as EventTagDefinition)
            : { ...tag, ...changes };
        }),
        events: nextTagId
          ? draft.events.map((event) => ({
              ...event,
              tags: event.tags?.map((assignment) =>
                assignment.tagId === tagId ? { ...assignment, tagId: nextTagId } : assignment,
              ),
            }))
          : draft.events,
      } as RunDataset;
    });
    if (changes.id && changes.id !== tagId) setSelectedTagId(changes.id);
  }

  function optionalTagDescription(tagId: string, value: string) {
    mutate((draft) =>
      parseRunDataset({
        ...draft,
        tags: draft.tags.map((tag) => {
          if (tag.id !== tagId) return tag;
          const nextTag: EventTagDefinition = { ...tag };
          if (value.trim()) nextTag.description = value.trim();
          else delete nextTag.description;
          return nextTag;
        }),
      }),
    );
  }

  function deleteTag(tagId: string) {
    if (!confirm(`Delete tag ${tagId}? Events using it will lose that assignment.`)) return;
    mutate((draft) =>
      parseRunDataset({
        ...draft,
        tags: draft.tags.filter((tag) => tag.id !== tagId),
        events: draft.events.map((event) => {
          const tags = event.tags?.filter((assignment) => assignment.tagId !== tagId);
          if (!tags?.length) {
            const nextEvent = { ...event };
            delete (nextEvent as unknown as Record<string, unknown>).tags;
            return nextEvent;
          }
          return { ...event, tags };
        }),
      }),
    );
    setSelectedTagId("");
  }

  return (
    <div className="editor-stack">
      <header className="editor-heading">
        <p>Reference library</p>
        <h2>Rules & tags</h2>
        <span>
          Keep rule wording, tag meaning, and authoring metadata together so later events can
          reference them consistently.
        </span>
      </header>

      <div className="editor-split library-split">
        <section className="editor-list-panel">
          <div className="card-heading">
            <div>
              <p>Rules</p>
              <h2>{dataset.rules.length} rules</h2>
            </div>
            <button className="button-primary" onClick={addRule}>
              + Rule
            </button>
          </div>
          <div className="entity-list">
            {dataset.rules.map((rule) => (
              <button
                key={rule.id}
                className={selectedRule?.id === rule.id ? "selected" : ""}
                onClick={() => setSelectedRuleId(rule.id)}
              >
                <span>
                  <strong>{rule.title}</strong>
                  <small>
                    {titleCase(rule.category)} · {rule.versions.length} version
                    {rule.versions.length === 1 ? "" : "s"}
                  </small>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="editor-detail-panel">
          {selectedRule ? (
            <>
              <div className="card-heading">
                <div>
                  <p>{selectedRule.id}</p>
                  <h2>{selectedRule.title}</h2>
                </div>
                <button onClick={() => deleteRule(selectedRule.id)}>Delete rule</button>
              </div>
              <div className="form-grid">
                <Field label="Rule title">
                  <input
                    value={selectedRule.title}
                    onChange={(event) => updateRule(selectedRule.id, { title: event.target.value })}
                  />
                </Field>
                <Field label="Category">
                  <select
                    value={selectedRule.category}
                    onChange={(event) =>
                      updateRule(selectedRule.id, { category: event.target.value as RuleCategory })
                    }
                  >
                    {RULE_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {titleCase(category)}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="form-grid">
                <Field
                  label="Rule ID"
                  hint="Stable identifier; locked after creation so historical rulings remain stable."
                >
                  <input value={selectedRule.id} readOnly />
                </Field>
                <Field label="Short summary">
                  <input
                    value={selectedRule.shortSummary}
                    onChange={(event) =>
                      updateRule(selectedRule.id, { shortSummary: event.target.value })
                    }
                  />
                </Field>
              </div>

              <div className="card-heading card-heading--subtle">
                <div>
                  <p>Versions</p>
                  <h3>Episode-specific wording</h3>
                </div>
                <button onClick={() => addRuleVersion(selectedRule.id)}>+ Version</button>
              </div>
              <div className="stack-list">
                {selectedRule.versions.map((version, index) => (
                  <div key={`${selectedRule.id}-${index}`} className="stack-card">
                    <div className="stack-card__header">
                      <strong>Version {index + 1}</strong>
                      <button
                        onClick={() => deleteRuleVersion(selectedRule.id, index)}
                        disabled={selectedRule.versions.length <= 1}
                      >
                        Remove
                      </button>
                    </div>
                    <div className="form-grid form-grid--3">
                      <Field label="Effective from episode">
                        <input
                          type="number"
                          min="1"
                          value={version.effectiveFromEpisode}
                          onChange={(event) =>
                            updateRuleVersion(selectedRule.id, index, {
                              effectiveFromEpisode: Number(event.target.value),
                            })
                          }
                        />
                      </Field>
                      <Field label="Summary">
                        <input
                          value={version.summary}
                          onChange={(event) =>
                            updateRuleVersion(selectedRule.id, index, {
                              summary: event.target.value,
                            })
                          }
                        />
                      </Field>
                    </div>
                    <Field label="Description">
                      <textarea
                        rows={3}
                        value={version.description}
                        onChange={(event) =>
                          updateRuleVersion(selectedRule.id, index, {
                            description: event.target.value,
                          })
                        }
                      />
                    </Field>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p>No rules yet. Add one to get started.</p>
          )}
        </section>
      </div>

      <div className="editor-split library-split">
        <section className="editor-list-panel">
          <div className="card-heading">
            <div>
              <p>Tags</p>
              <h2>{dataset.tags.length} tags</h2>
            </div>
            <button className="button-primary" onClick={addTag}>
              + Tag
            </button>
          </div>
          <div className="entity-list">
            {dataset.tags.map((tag) => (
              <button
                key={tag.id}
                className={selectedTag?.id === tag.id ? "selected" : ""}
                onClick={() => setSelectedTagId(tag.id)}
              >
                <span>
                  <strong>{tag.label}</strong>
                  <small>{titleCase(tag.style)}</small>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="editor-detail-panel">
          {selectedTag ? (
            <>
              <div className="card-heading">
                <div>
                  <p>{selectedTag.id}</p>
                  <h2>{selectedTag.label}</h2>
                </div>
                <button onClick={() => deleteTag(selectedTag.id)}>Delete tag</button>
              </div>
              <div className="form-grid form-grid--3">
                <Field label="Tag label">
                  <input
                    value={selectedTag.label}
                    onChange={(event) => updateTag(selectedTag.id, { label: event.target.value })}
                  />
                </Field>
                <Field label="Tag style">
                  <select
                    value={selectedTag.style}
                    onChange={(event) =>
                      updateTag(selectedTag.id, { style: event.target.value as TagStyle })
                    }
                  >
                    {TAG_STYLES.map((style) => (
                      <option key={style} value={style}>
                        {titleCase(style)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label="Tag ID"
                  hint="Stable identifier; locked after creation so existing event assignments remain stable."
                >
                  <input value={selectedTag.id} readOnly />
                </Field>
              </div>
              <Field
                label="Description"
                hint="Optional helper text for the editor and tooltip copy."
              >
                <textarea
                  rows={3}
                  value={selectedTag.description ?? ""}
                  onChange={(event) => optionalTagDescription(selectedTag.id, event.target.value)}
                />
              </Field>
            </>
          ) : (
            <p>No tags yet. Add one to get started.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function Episodes({
  series,
  dataset,
  youtubeConfigured,
  mutate,
  setError,
}: {
  series: RunSeries;
  dataset: RunDataset;
  youtubeConfigured: boolean;
  mutate(fn: (draft: RunDataset) => RunDataset): void;
  setError(value: string): void;
}) {
  const [selectedId, setSelectedId] = useState(dataset.episodes.at(-1)?.id ?? "");
  const [url, setUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const selected = dataset.episodes.find((episode) => episode.id === selectedId);

  function replace(next: Episode) {
    mutate((draft) =>
      parseRunDataset({
        ...draft,
        episodes: draft.episodes.map((episode) => (episode.id === next.id ? next : episode)),
      }),
    );
  }

  function patch(changes: Partial<Episode>) {
    if (!selected) return;
    replace({ ...selected, ...changes });
  }

  function optionalPatch(key: "titleOverride" | "summary", value: string) {
    if (!selected) return;
    const next = { ...selected };
    if (value.trim()) {
      (next as unknown as Record<string, unknown>)[key] = value;
    } else {
      delete (next as unknown as Record<string, unknown>)[key];
    }
    replace(next);
  }

  function add() {
    const episode = nextEpisode(dataset, series);
    mutate((draft) => parseRunDataset({ ...draft, episodes: [...draft.episodes, episode] }));
    setSelectedId(episode.id);
    setUrl("");
  }

  async function doImport() {
    if (!selected || !url.trim()) return;
    setImporting(true);
    setError("");
    try {
      const response = await importYouTube(url);
      patch({ youtube: response.metadata });
      setUrl(response.metadata.url);
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value));
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="editor-split">
      <section className="editor-list-panel">
        <div className="card-heading">
          <div>
            <p>Episodes</p>
            <h2>Run releases</h2>
          </div>
          <button className="button-primary" onClick={add}>
            + Episode
          </button>
        </div>
        <div className="entity-list">
          {[...dataset.episodes]
            .sort((a, b) => a.number - b.number)
            .map((episode) => (
              <button
                key={episode.id}
                className={selectedId === episode.id ? "selected" : ""}
                onClick={() => {
                  setSelectedId(episode.id);
                  setUrl(episode.youtube?.url ?? "");
                }}
              >
                <span>
                  <strong>Episode {episode.number}</strong>
                  <small>{episode.titleOverride || episode.youtube?.title || "Untitled"}</small>
                </span>
                <b className={`status-pill status-pill--${episode.status}`}>{episode.status}</b>
              </button>
            ))}
        </div>
      </section>

      <section className="editor-detail-panel">
        {selected ? (
          <>
            <div className="card-heading">
              <div>
                <p>{selected.id}</p>
                <h2>Episode {selected.number}</h2>
              </div>
              <select
                value={selected.status}
                onChange={(event) => patch({ status: event.target.value as Episode["status"] })}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
            <div className="form-grid">
              <Field label="Episode number">
                <input
                  type="number"
                  min="1"
                  value={selected.number}
                  onChange={(event) => patch({ number: Number(event.target.value) })}
                />
              </Field>
              <Field label="Title override">
                <input
                  value={selected.titleOverride ?? ""}
                  placeholder={selected.youtube?.title ?? "Optional"}
                  onChange={(event) => optionalPatch("titleOverride", event.target.value)}
                />
              </Field>
            </div>
            <Field label="Summary">
              <textarea
                rows={3}
                value={selected.summary ?? ""}
                onChange={(event) => optionalPatch("summary", event.target.value)}
              />
            </Field>

            <section className="youtube-import">
              <div>
                <p>YouTube metadata</p>
                <h3>Paste the episode URL</h3>
                <small>
                  {youtubeConfigured
                    ? "Imports title, description, channel, date, duration and thumbnail."
                    : "Copy .env.example to .env.local, add YOUTUBE_API_KEY, then restart the editor."}
                </small>
              </div>
              <div className="inline-control">
                <input
                  type="url"
                  placeholder="https://youtube.com/watch?v=…"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                />
                <button
                  onClick={() => void doImport()}
                  disabled={!youtubeConfigured || importing || !url.trim()}
                >
                  {importing ? "Importing…" : "Import"}
                </button>
              </div>
              {selected.youtube ? (
                <div className="youtube-preview">
                  <img src={selected.youtube.thumbnail.url} alt="" />
                  <div>
                    <strong>{selected.youtube.title}</strong>
                    <span>{selected.youtube.channelTitle}</span>
                    <small>
                      {Math.floor(selected.youtube.durationSeconds / 60)} min ·{" "}
                      {new Date(selected.youtube.publishedAt).toLocaleString()}
                    </small>
                  </div>
                </div>
              ) : null}
            </section>
          </>
        ) : (
          <p>Select an episode.</p>
        )}
      </section>
    </div>
  );
}

function Events({
  series,
  dataset,
  mutate,
  setError,
}: {
  series: RunSeries;
  dataset: RunDataset;
  mutate(fn: (draft: RunDataset) => RunDataset): void;
  setError(value: string): void;
}) {
  const [form, setForm] = useState<EventDraftInput>(() => createEventForm(dataset));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [species, setSpecies] = useState<PokemonSpeciesOption[]>([]);
  const [abilities, setAbilities] = useState<PokemonAbilityOption[]>([]);

  const state = useMemo(() => reconstructHgssRun(dataset, { episodeStatus: "all" }), [dataset]);
  const location = HGSS_MAIN_STORY_LOCATIONS.find((entry) => entry.id === form.locationId);
  const idPools = useMemo<EventIdPools>(
    () => ({
      eventIds: series.runs.flatMap((run) => run.events.map((event) => event.id)),
      pokemonIds: series.runs.flatMap((run) => run.pokemon.map((pokemon) => pokemon.id)),
      soulLinkIds: series.runs.flatMap((run) => run.soulLinks.map((link) => link.id)),
    }),
    [series],
  );

  useEffect(() => {
    void loadSpeciesCatalog()
      .then((response) => setSpecies(response.species))
      .catch(() => setSpecies([]));
    void loadAbilityCatalog()
      .then((response) => setAbilities(response.abilities))
      .catch(() => setAbilities([]));
  }, []);

  function patch(changes: Partial<EventDraftInput>) {
    setForm((current) => ({ ...current, ...changes }));
  }

  function reset() {
    const fallbackEpisodeId =
      form.episodeId && dataset.episodes.some((episode) => episode.id === form.episodeId)
        ? form.episodeId
        : (dataset.episodes.at(-1)?.id ?? "");
    setEditingId(null);
    setForm({
      ...createEventForm(dataset),
      episodeId: fallbackEpisodeId,
      sequence: fallbackEpisodeId ? nextEventSequence(dataset.events, fallbackEpisodeId) : 10,
    });
  }

  function saveEvent() {
    try {
      mutate((draft) =>
        editingId
          ? updateEventInDataset(draft, editingId, form, idPools)
          : addEventToDataset(draft, form, idPools),
      );
      reset();
      setError("");
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value));
    }
  }

  function startEdit(event: RunEvent) {
    setEditingId(event.id);
    setForm(eventToForm(dataset, event));
    setError("");
  }

  function orderedEvents(episodeId: string) {
    return dataset.events
      .filter((event) => event.episodeId === episodeId)
      .sort((a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id));
  }

  function applyOrder(episodeId: string, ids: string[]) {
    mutate((draft) => parseRunDataset(normalizeEpisodeEventOrder(draft, episodeId, ids)));
  }

  function moveEvent(episodeId: string, eventId: string, direction: -1 | 1) {
    const ids = orderedEvents(episodeId).map((event) => event.id);
    const index = ids.indexOf(eventId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    applyOrder(episodeId, ids);
  }

  function dropEvent(episodeId: string, targetId: string) {
    if (!draggingId || draggingId === targetId) return;
    const ids = orderedEvents(episodeId).map((event) => event.id);
    const from = ids.indexOf(draggingId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(from, 1);
    ids.splice(to, 0, draggingId);
    applyOrder(episodeId, ids);
    setDraggingId(null);
  }

  const episodeGroups = [...dataset.episodes]
    .sort((a, b) => b.number - a.number)
    .map((episode) => ({ episode, events: orderedEvents(episode.id) }));
  const progressionKeys =
    form.progressionKind === "badge"
      ? HGSS_BADGE_KEYS
      : form.progressionKind === "capability"
        ? HGSS_CAPABILITY_KEYS
        : HGSS_MILESTONE_KEYS;

  return (
    <div className="editor-split editor-split--events">
      <section className="editor-list-panel">
        <div className="card-heading">
          <div>
            <p>Run history</p>
            <h2>{dataset.events.length} events</h2>
          </div>
          <button onClick={reset} disabled={!dataset.episodes.length}>
            + New event
          </button>
        </div>
        {!dataset.episodes.length ? (
          <p className="muted-copy">Create an episode for this run before adding events.</p>
        ) : (
          <div className="event-episode-groups">
            {episodeGroups.map(({ episode, events }) => (
              <section className="event-episode-group" key={episode.id}>
                <header>
                  <div>
                    <strong>Episode {episode.number}</strong>
                    <small>{episode.titleOverride || episode.youtube?.title || "Untitled"}</small>
                  </div>
                  <span>
                    {events.length} event{events.length === 1 ? "" : "s"}
                  </span>
                </header>
                <div className="event-editor-list">
                  {events.length ? (
                    events.map((event, index) => (
                      <article
                        key={event.id}
                        className={`${editingId === event.id ? "selected" : ""}${draggingId === event.id ? " dragging" : ""}`}
                        onDragOver={(dragEvent) => {
                          if (draggingId) dragEvent.preventDefault();
                        }}
                        onDrop={(dragEvent) => {
                          dragEvent.preventDefault();
                          dropEvent(episode.id, event.id);
                        }}
                      >
                        <span
                          className="event-drag-handle"
                          title="Drag to reorder"
                          aria-label="Drag to reorder"
                          draggable
                          onDragStart={(dragEvent) => {
                            setDraggingId(event.id);
                            dragEvent.dataTransfer.effectAllowed = "move";
                            dragEvent.dataTransfer.setData("text/plain", event.id);
                          }}
                          onDragEnd={() => setDraggingId(null)}
                        >
                          ⋮⋮
                        </span>
                        <button className="event-edit-target" onClick={() => startEdit(event)}>
                          <strong>
                            {event.title ||
                              EVENT_TYPES.find((type) => type.value === event.type)?.label ||
                              event.type}
                          </strong>
                          <small>
                            order {event.sequence}
                            {event.videoTimestampSeconds !== undefined
                              ? ` · ${formatTimestampInput(event.videoTimestampSeconds)}`
                              : ""}
                          </small>
                        </button>
                        <div className="event-list-actions">
                          <button
                            title="Move earlier in this episode"
                            disabled={index === 0}
                            onClick={() => moveEvent(episode.id, event.id, -1)}
                          >
                            ↑
                          </button>
                          <button
                            title="Move later in this episode"
                            disabled={index === events.length - 1}
                            onClick={() => moveEvent(episode.id, event.id, 1)}
                          >
                            ↓
                          </button>
                          <button
                            className="event-delete"
                            onClick={() => {
                              if (
                                confirm(
                                  `Delete ${event.id}? Created Pokémon/links will also be removed.`,
                                )
                              ) {
                                mutate((draft) => deleteEventFromDataset(draft, event.id));
                                if (editingId === event.id) reset();
                              }
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </article>
                    ))
                  ) : (
                    <p className="empty-group-copy">No events recorded for this episode yet.</p>
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>

      <section className="editor-detail-panel event-form">
        <div className="card-heading">
          <div>
            <p>{editingId ? "Edit event" : "Add event"}</p>
            <h2>{EVENT_TYPES.find((type) => type.value === form.type)?.label}</h2>
          </div>
          <div className="editor-inline-actions">
            {editingId ? <button onClick={reset}>Cancel</button> : null}
            <button className="button-primary" onClick={saveEvent}>
              {editingId ? "Save changes" : "Add event"}
            </button>
          </div>
        </div>

        <div className="form-grid">
          <Field label="Episode">
            <select
              value={form.episodeId}
              onChange={(event) =>
                patch({
                  episodeId: event.target.value,
                  sequence: editingId
                    ? form.sequence
                    : nextEventSequence(dataset.events, event.target.value),
                })
              }
            >
              {[...dataset.episodes]
                .sort((a, b) => a.number - b.number)
                .map((episode) => (
                  <option key={episode.id} value={episode.id}>
                    Episode {episode.number}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Type">
            <select
              value={form.type}
              onChange={(event) => patch({ type: event.target.value as RunEvent["type"] })}
            >
              {EVENT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="form-grid form-grid--3">
          <Field label="Video timestamp" hint="mm:ss or h:mm:ss">
            <input
              value={form.timestamp}
              placeholder="24:07"
              onChange={(event) => patch({ timestamp: event.target.value })}
            />
          </Field>
          <Field label="Tone">
            <select
              value={form.tone}
              onChange={(event) => patch({ tone: event.target.value as EventDraftInput["tone"] })}
            >
              {["positive", "negative", "neutral", "mixed"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </Field>
          <Field label="Importance">
            <select
              value={form.importance}
              onChange={(event) =>
                patch({ importance: event.target.value as EventDraftInput["importance"] })
              }
            >
              {["minor", "normal", "major"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </Field>
        </div>

        <details className="advanced-settings">
          <summary>Advanced ordering</summary>
          <Field
            label="Event order"
            hint="Controls order within this episode when events share/no timestamp. Assigned automatically in steps of 10."
          >
            <input
              type="number"
              value={form.sequence}
              onChange={(event) => patch({ sequence: Number(event.target.value) })}
            />
          </Field>
        </details>

        <div className="form-grid">
          <Field label="Title">
            <input value={form.title} onChange={(event) => patch({ title: event.target.value })} />
          </Field>
          <Field label="Description">
            <input
              value={form.description}
              onChange={(event) => patch({ description: event.target.value })}
            />
          </Field>
        </div>

        <Field
          label="Tags"
          hint="Ctrl/Cmd-click for multiple. Tag names/styles are managed under Rules & Tags; the labelled text banners are edited in Annotations below."
        >
          <select
            multiple
            size={Math.max(3, dataset.tags.length)}
            value={form.tagIds}
            onChange={(event) =>
              patch({
                tagIds: Array.from(
                  event.currentTarget.selectedOptions,
                  (option: HTMLOptionElement) => option.value,
                ),
              })
            }
          >
            {dataset.tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.label}
              </option>
            ))}
          </select>
        </Field>

        <section className="annotation-editor">
          <div className="card-heading card-heading--subtle">
            <div>
              <p>Event banners</p>
              <h3>Annotations</h3>
              <small>
                These are the labelled notes that appear below an event, such as Community, Rules or
                Context.
              </small>
            </div>
            <button
              type="button"
              onClick={() =>
                patch({
                  annotations: [...form.annotations, { kind: "note", text: "", ruleId: "" }],
                })
              }
            >
              + Annotation
            </button>
          </div>
          {form.annotations.length ? (
            <div className="stack-list">
              {form.annotations.map((annotation, index) => (
                <div
                  className="stack-card annotation-editor__row"
                  key={`${index}-${annotation.kind}`}
                >
                  <div className="form-grid form-grid--3">
                    <Field label="Label">
                      <select
                        value={annotation.kind}
                        onChange={(event) => {
                          const next = [...form.annotations];
                          next[index] = {
                            ...annotation,
                            kind: event.target.value as typeof annotation.kind,
                          };
                          patch({ annotations: next });
                        }}
                      >
                        {[
                          ["note", "Note"],
                          ["community", "Community"],
                          ["rules", "Rules"],
                          ["correction", "Correction"],
                          ["context", "Context"],
                        ].map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Rule" hint="Optional">
                      <select
                        value={annotation.ruleId}
                        onChange={(event) => {
                          const next = [...form.annotations];
                          next[index] = { ...annotation, ruleId: event.target.value };
                          patch({ annotations: next });
                        }}
                      >
                        <option value="">No linked rule</option>
                        {dataset.rules.map((rule) => (
                          <option key={rule.id} value={rule.id}>
                            {rule.title}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <div className="annotation-editor__remove">
                      <button
                        type="button"
                        onClick={() =>
                          patch({
                            annotations: form.annotations.filter(
                              (_, itemIndex) => itemIndex !== index,
                            ),
                          })
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <Field label="Text">
                    <textarea
                      rows={2}
                      value={annotation.text}
                      onChange={(event) => {
                        const next = [...form.annotations];
                        next[index] = { ...annotation, text: event.target.value };
                        patch({ annotations: next });
                      }}
                    />
                  </Field>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted-copy">No annotation banners on this event.</p>
          )}
        </section>

        {form.type === "encounter" ? (
          <EncounterFields
            dataset={dataset}
            form={form}
            patch={patch}
            location={location}
            species={species}
            abilities={abilities}
          />
        ) : null}
        {[
          "evolution",
          "nickname-changed",
          "level-milestone",
          "move-changed",
          "held-item-changed",
          "ability-changed",
          "form-changed",
          "pokemon-death",
          "pokemon-revived",
        ].includes(form.type) ? (
          <PokemonFields
            dataset={dataset}
            state={state}
            form={form}
            patch={patch}
            species={species}
          />
        ) : null}
        {form.type === "party-changed" ? (
          <>
            <PokemonMulti
              dataset={dataset}
              value={form.pokemonIds}
              onChange={(value) => patch({ pokemonIds: value })}
            />
            <div className="form-grid">
              <Field label="Destination">
                <select
                  value={form.destination}
                  onChange={(event) =>
                    patch({ destination: event.target.value as EventDraftInput["destination"] })
                  }
                >
                  <option value="party">Party</option>
                  <option value="box">Box</option>
                  <option value="retired">Retired</option>
                </select>
              </Field>
              <Field label="Reason">
                <input
                  value={form.reason}
                  onChange={(event) => patch({ reason: event.target.value })}
                />
              </Field>
            </div>
          </>
        ) : null}
        {form.type === "gym-battle" ? (
          <>
            <div className="form-grid form-grid--3">
              <Field label="Gym">
                <select
                  value={form.gymId}
                  onChange={(event) => {
                    const gym = GYMS.find((entry) => entry[0] === event.target.value);
                    patch({
                      gymId: event.target.value,
                      leaderName: gym?.[1] ?? "",
                      badgeId: gym?.[2] ?? "",
                    });
                  }}
                >
                  {GYMS.map(([id, leader]) => (
                    <option key={id} value={id}>
                      {leader}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Leader">
                <input
                  value={form.leaderName}
                  onChange={(event) => patch({ leaderName: event.target.value })}
                />
              </Field>
              <Field label="Result">
                <select
                  value={form.result}
                  onChange={(event) => patch({ result: event.target.value })}
                >
                  <option value="win">Win</option>
                  <option value="loss">Loss</option>
                </select>
              </Field>
            </div>
            <PokemonMulti
              dataset={dataset}
              value={form.pokemonIds}
              onChange={(value) => patch({ pokemonIds: value })}
            />
          </>
        ) : null}
        {form.type === "major-battle" ? (
          <>
            <Field label="Result">
              <select
                value={form.result}
                onChange={(event) => patch({ result: event.target.value })}
              >
                {["win", "loss", "draw", "escaped", "other"].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </Field>
            <PokemonMulti
              dataset={dataset}
              value={form.pokemonIds}
              onChange={(value) => patch({ pokemonIds: value })}
            />
          </>
        ) : null}
        {form.type === "progression-changed" ? (
          <div className="form-grid form-grid--3">
            <Field label="Kind">
              <select
                value={form.progressionKind}
                onChange={(event) => {
                  const kind = event.target.value as EventDraftInput["progressionKind"];
                  const keys =
                    kind === "badge"
                      ? HGSS_BADGE_KEYS
                      : kind === "capability"
                        ? HGSS_CAPABILITY_KEYS
                        : HGSS_MILESTONE_KEYS;
                  patch({ progressionKind: kind, progressionId: keys[0] });
                }}
              >
                <option value="badge">Badge</option>
                <option value="capability">Capability</option>
                <option value="milestone">Milestone</option>
              </select>
            </Field>
            <Field label="Flag">
              <select
                value={form.progressionId}
                onChange={(event) => patch({ progressionId: event.target.value })}
              >
                {progressionKeys.map((key) => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Value">
              <select
                value={String(form.progressionValue)}
                onChange={(event) => patch({ progressionValue: event.target.value === "true" })}
              >
                <option value="true">Unlocked / true</option>
                <option value="false">Removed / false</option>
              </select>
            </Field>
          </div>
        ) : null}
        {form.type === "special-moment" || form.type === "custom" ? (
          <>
            <PokemonMulti
              dataset={dataset}
              value={form.pokemonIds}
              onChange={(value) => patch({ pokemonIds: value })}
            />
            <LinkMulti
              dataset={dataset}
              value={form.soulLinkIds}
              onChange={(value) => patch({ soulLinkIds: value })}
            />
          </>
        ) : null}
        {form.type === "rule-ruling" ? (
          <div className="form-grid">
            <Field label="Rule">
              <select
                value={form.ruleId}
                onChange={(event) => patch({ ruleId: event.target.value })}
              >
                {dataset.rules.map((rule) => (
                  <option key={rule.id} value={rule.id}>
                    {rule.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Ruling">
              <select
                value={form.ruling}
                onChange={(event) =>
                  patch({ ruling: event.target.value as EventDraftInput["ruling"] })
                }
              >
                {["violation", "dispute", "exception", "clarification"].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </Field>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function EncounterSide({
  which,
  dataset,
  form,
  patch,
  species,
  abilities,
}: {
  which: "left" | "right";
  dataset: RunDataset;
  form: EventDraftInput;
  patch(value: Partial<EventDraftInput>): void;
  species: PokemonSpeciesOption[];
  abilities: PokemonAbilityOption[];
}) {
  const side = form[which];
  const playerId = dataset.run.playerIds[which === "left" ? 0 : 1];
  const player = dataset.players.find((entry) => entry.id === playerId);
  const update = (changes: Partial<EventDraftInput["left"]>) =>
    patch({ [which]: { ...side, ...changes } } as Partial<EventDraftInput>);

  return (
    <div className={`outcome-card${side.shiny ? " outcome-card--shiny" : ""}`}>
      <div className="card-heading">
        <div>
          <p>{player?.displayName || which}</p>
          <h3>{which === "left" ? "Player one" : "Player two"}</h3>
        </div>
        {side.shiny && side.result === "caught" ? (
          <span className="mini-pill">✨ Shiny</span>
        ) : null}
      </div>
      <Field label="Outcome">
        <select
          value={side.result}
          onChange={(event) => update({ result: event.target.value as typeof side.result })}
        >
          <option value="caught">Caught</option>
          <option value="failed">Failed</option>
          <option value="skipped">Skipped</option>
        </select>
      </Field>
      <SpeciesSelect
        label="Species"
        value={side.speciesId}
        species={species}
        onChange={(value) => update({ speciesId: value })}
      />
      {side.result !== "caught" ? (
        <Field label="Reason" hint="Optional">
          <input
            value={side.reason}
            onChange={(event) => update({ reason: event.target.value })}
            placeholder="Encounter fled, duplicate reroll, skipped…"
          />
        </Field>
      ) : null}
      {side.result === "caught" ? (
        <>
          <Field label="Nickname">
            <input
              value={side.nickname}
              onChange={(event) => update({ nickname: event.target.value })}
            />
          </Field>
          <div className="form-grid">
            <Field label="Level">
              <input
                type="number"
                min="1"
                value={side.level}
                onChange={(event) => update({ level: event.target.value })}
              />
            </Field>
            <Field label="Placement">
              <select
                value={side.placement}
                onChange={(event) =>
                  update({ placement: event.target.value as typeof side.placement })
                }
              >
                <option value="party">Party</option>
                <option value="box">Box</option>
              </select>
            </Field>
          </div>
          <div className="form-grid">
            <Field label="Nature">
              <select
                value={side.natureId}
                onChange={(event) => update({ natureId: event.target.value })}
              >
                <option value="">Unknown / not recorded</option>
                {NATURES.map((nature) => (
                  <option key={nature} value={nature}>
                    {nature.charAt(0).toUpperCase() + nature.slice(1)}
                  </option>
                ))}
              </select>
            </Field>
            <AbilitySelect
              value={side.abilityId}
              abilities={abilities}
              onChange={(value) => update({ abilityId: value })}
            />
          </div>
          <div className="form-grid">
            <Field label="Gender">
              <select
                value={side.gender}
                onChange={(event) => update({ gender: event.target.value as typeof side.gender })}
              >
                <option value="unknown">Unknown</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="genderless">Genderless</option>
              </select>
            </Field>
            <label className="check-field">
              <input
                type="checkbox"
                checked={side.shiny}
                onChange={(event) => update({ shiny: event.target.checked })}
              />
              <span>Shiny</span>
            </label>
          </div>
        </>
      ) : null}
    </div>
  );
}

function EncounterFields({
  dataset,
  form,
  patch,
  location,
  species,
  abilities,
}: {
  dataset: RunDataset;
  form: EventDraftInput;
  patch(value: Partial<EventDraftInput>): void;
  location: (typeof HGSS_MAIN_STORY_LOCATIONS)[number] | undefined;
  species: PokemonSpeciesOption[];
  abilities: PokemonAbilityOption[];
}) {
  const locationOptions = HGSS_MAIN_STORY_LOCATIONS.map((entry) => ({
    value: entry.id,
    label: entry.name,
  }));

  return (
    <>
      <div className="form-grid">
        <FilteredSelect
          label="Location"
          value={form.locationId}
          options={locationOptions}
          placeholder="Search locations…"
          onChange={(value) => {
            const nextLocation = HGSS_MAIN_STORY_LOCATIONS.find((entry) => entry.id === value);
            patch({
              locationId: value,
              opportunityId: nextLocation?.opportunities[0]?.id ?? "",
              acquisitionType: nextLocation?.opportunities[0]?.kind ?? "wild",
            });
          }}
        />
        <Field label="Opportunity">
          <select
            value={form.opportunityId}
            onChange={(event) => {
              const opportunity = location?.opportunities.find(
                (entry) => entry.id === event.target.value,
              );
              patch({
                opportunityId: event.target.value,
                acquisitionType: opportunity?.kind ?? form.acquisitionType,
              });
            }}
          >
            {location?.opportunities.map((opportunity) => (
              <option key={opportunity.id} value={opportunity.id}>
                {opportunity.label} · {opportunity.kind}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="outcome-grid">
        <EncounterSide
          which="left"
          dataset={dataset}
          form={form}
          patch={patch}
          species={species}
          abilities={abilities}
        />
        <EncounterSide
          which="right"
          dataset={dataset}
          form={form}
          patch={patch}
          species={species}
          abilities={abilities}
        />
      </div>
    </>
  );
}

function PokemonFields({
  dataset,
  state,
  form,
  patch,
  species,
}: {
  dataset: RunDataset;
  state: ReturnType<typeof reconstructHgssRun>;
  form: EventDraftInput;
  patch(value: Partial<EventDraftInput>): void;
  species: PokemonSpeciesOption[];
}) {
  const chosen = form.pokemonId ? state.pokemon.get(form.pokemonId as never) : undefined;

  return (
    <>
      <Field label="Pokémon">
        <select
          value={form.pokemonId}
          onChange={(event) => {
            const pokemon = state.pokemon.get(event.target.value as never);
            patch({
              pokemonId: event.target.value,
              fromSpeciesId: pokemon ? String(pokemon.currentSpeciesId) : "",
              previousValue: pokemon?.currentNickname ?? "",
            });
          }}
        >
          <option value="">Select Pokémon…</option>
          {dataset.pokemon.map((pokemon) => {
            const statePokemon = state.pokemon.get(pokemon.id);
            return (
              <option key={pokemon.id} value={pokemon.id}>
                {statePokemon?.currentNickname || pokemon.id} · #
                {statePokemon?.currentSpeciesId ?? pokemon.initialSpeciesId}
              </option>
            );
          })}
        </select>
      </Field>
      {form.type === "evolution" ? (
        <div className="form-grid form-grid--3">
          <SpeciesSelect
            label="From species"
            value={form.fromSpeciesId || (chosen ? String(chosen.currentSpeciesId) : "")}
            species={species}
            onChange={(value) => patch({ fromSpeciesId: value })}
          />
          <SpeciesSelect
            label="To species"
            value={form.toSpeciesId}
            species={species}
            onChange={(value) => patch({ toSpeciesId: value })}
          />
          <Field label="Level">
            <input
              type="number"
              value={form.level}
              onChange={(event) => patch({ level: event.target.value })}
            />
          </Field>
        </div>
      ) : null}
      {form.type === "nickname-changed" ? (
        <div className="form-grid">
          <Field label="Previous nickname">
            <input
              value={form.previousValue}
              onChange={(event) => patch({ previousValue: event.target.value })}
            />
          </Field>
          <Field label="New nickname">
            <input
              value={form.nickname}
              onChange={(event) => patch({ nickname: event.target.value })}
            />
          </Field>
        </div>
      ) : null}
      {form.type === "level-milestone" ? (
        <Field label="Level">
          <input
            type="number"
            value={form.level}
            onChange={(event) => patch({ level: event.target.value })}
          />
        </Field>
      ) : null}
      {form.type === "move-changed" ? (
        <div className="form-grid">
          <Field label="Learned move ID">
            <input
              value={form.learnedMoveId}
              onChange={(event) => patch({ learnedMoveId: event.target.value })}
            />
          </Field>
          <Field label="Forgotten move ID">
            <input
              value={form.forgottenMoveId}
              onChange={(event) => patch({ forgottenMoveId: event.target.value })}
            />
          </Field>
        </div>
      ) : null}
      {["held-item-changed", "ability-changed", "form-changed"].includes(form.type) ? (
        <div className="form-grid">
          <Field label="Previous value">
            <input
              value={form.previousValue}
              onChange={(event) => patch({ previousValue: event.target.value })}
            />
          </Field>
          <Field label="New value">
            <input
              value={form.nextValue}
              onChange={(event) => patch({ nextValue: event.target.value })}
            />
          </Field>
        </div>
      ) : null}
      {form.type === "pokemon-death" ? (
        <>
          <div className="form-grid">
            <FilteredSelect
              label="Location"
              value={form.locationId}
              options={[
                { value: "", label: "Not recorded" },
                ...HGSS_MAIN_STORY_LOCATIONS.map((location) => ({
                  value: location.id,
                  label: location.name,
                })),
              ]}
              placeholder="Search locations…"
              onChange={(value) => patch({ locationId: value })}
            />
            <Field label="Opponent">
              <input
                value={form.opponentName}
                onChange={(event) => patch({ opponentName: event.target.value })}
              />
            </Field>
          </div>
          <Field label="Cause">
            <textarea
              rows={3}
              value={form.cause}
              onChange={(event) => patch({ cause: event.target.value })}
            />
          </Field>
        </>
      ) : null}
      {form.type === "pokemon-revived" ? (
        <Field label="Reason">
          <input value={form.reason} onChange={(event) => patch({ reason: event.target.value })} />
        </Field>
      ) : null}
    </>
  );
}

function FilteredSelect({
  label,
  value,
  options,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange(value: string): void;
  placeholder: string;
  hint?: string;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized
      ? options.filter(
          (option) =>
            option.label.toLowerCase().includes(normalized) ||
            option.value.toLowerCase().includes(normalized),
        )
      : options;
  }, [query, options]);

  return (
    <Field label={label} hint={hint}>
      <div className="search-select">
        <input
          type="search"
          value={query}
          placeholder={placeholder}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          value={value}
          size={Math.min(6, Math.max(2, filtered.length))}
          onChange={(event) => {
            onChange(event.target.value);
            setQuery("");
          }}
        >
          {filtered.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </Field>
  );
}

function SpeciesSelect({
  label,
  value,
  species,
  onChange,
}: {
  label: string;
  value: string;
  species: PokemonSpeciesOption[];
  onChange(value: string): void;
}) {
  if (!species.length) {
    return (
      <Field label={label} hint="PokéAPI catalogue unavailable; enter National Dex ID.">
        <input
          type="number"
          min="1"
          max="493"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </Field>
    );
  }

  return (
    <FilteredSelect
      label={label}
      value={value}
      options={species.map((entry) => ({
        value: String(entry.id),
        label: `#${entry.id} · ${entry.name}`,
      }))}
      placeholder="Search Pokémon…"
      onChange={onChange}
    />
  );
}

function AbilitySelect({
  value,
  abilities,
  onChange,
}: {
  value: string;
  abilities: PokemonAbilityOption[];
  onChange(value: string): void;
}) {
  if (!abilities.length) {
    return (
      <Field label="Ability" hint="PokéAPI ability catalogue unavailable; type the ability ID.">
        <input value={value} onChange={(event) => onChange(event.target.value)} />
      </Field>
    );
  }

  return (
    <FilteredSelect
      label="Ability"
      value={value}
      options={[
        { value: "", label: "Unknown / not recorded" },
        ...abilities.map((entry) => ({ value: entry.id, label: entry.name })),
      ]}
      placeholder="Search abilities…"
      onChange={onChange}
    />
  );
}

function PokemonMulti({
  dataset,
  value,
  onChange,
}: {
  dataset: RunDataset;
  value: string[];
  onChange(value: string[]): void;
}) {
  return (
    <Field label="Pokémon involved" hint="Ctrl/Cmd-click for multiple">
      <select
        multiple
        size={Math.min(7, Math.max(3, dataset.pokemon.length))}
        value={value}
        onChange={(event) =>
          onChange(
            Array.from(
              event.currentTarget.selectedOptions,
              (option: HTMLOptionElement) => option.value,
            ),
          )
        }
      >
        {dataset.pokemon.map((pokemon) => (
          <option key={pokemon.id} value={pokemon.id}>
            {pokemon.id} · species #{pokemon.initialSpeciesId}
          </option>
        ))}
      </select>
    </Field>
  );
}

function LinkMulti({
  dataset,
  value,
  onChange,
}: {
  dataset: RunDataset;
  value: string[];
  onChange(value: string[]): void;
}) {
  return (
    <Field label="Soul Links involved">
      <select
        multiple
        size={Math.min(6, Math.max(3, dataset.soulLinks.length))}
        value={value}
        onChange={(event) =>
          onChange(
            Array.from(
              event.currentTarget.selectedOptions,
              (option: HTMLOptionElement) => option.value,
            ),
          )
        }
      >
        {dataset.soulLinks.map((link) => (
          <option key={link.id} value={link.id}>
            {link.id} · {link.pokemonIds.join(" + ")}
          </option>
        ))}
      </select>
    </Field>
  );
}

function DiffList({ label, diff }: { label: string; diff: PublishDiffResponse["episodes"] }) {
  const total = diff.added.length + diff.changed.length + diff.removed.length;
  if (!total) return null;
  return (
    <div className="publish-diff-list">
      <strong>{label}</strong>
      {diff.added.length ? <span className="diff-added">+ {diff.added.join(", ")}</span> : null}
      {diff.changed.length ? (
        <span className="diff-changed">~ {diff.changed.join(", ")}</span>
      ) : null}
      {diff.removed.length ? (
        <span className="diff-removed">− {diff.removed.join(", ")}</span>
      ) : null}
    </div>
  );
}

function BackupCard({
  backup,
  onRestore,
  disabled,
}: {
  backup: EditorBackupSummary;
  onRestore(backupId: string): void;
  disabled: boolean;
}) {
  return (
    <article className="backup-card">
      <div>
        <strong>{new Date(backup.createdAt).toLocaleString()}</strong>
        <small>{backup.id}</small>
      </div>
      <div className="backup-card__stats">
        <span>{backup.runCount} runs</span>
        <span>{backup.episodeCount} episodes</span>
        <span>{backup.eventCount} events</span>
        <span>{backup.pokemonCount} Pokémon</span>
        <span>{backup.soulLinkCount} links</span>
      </div>
      <button disabled={disabled} onClick={() => onRestore(backup.id)}>
        Load into draft
      </button>
    </article>
  );
}

function Publish({
  series,
  validation,
  bootstrap,
  dirty,
  save,
  setValidation,
  setMessage,
  setError,
  onPublished,
  refreshWorkspaceStatus,
  onRestoreDraft,
}: {
  series: RunSeries;
  validation: EditorValidationSummary;
  bootstrap: EditorBootstrapResponse;
  dirty: boolean;
  save(): Promise<boolean>;
  setValidation(value: EditorValidationSummary): void;
  setMessage(value: string): void;
  setError(value: string): void;
  onPublished(published: EditorBootstrapResponse["published"]): void;
  refreshWorkspaceStatus(): Promise<EditorBootstrapResponse | undefined>;
  onRestoreDraft(restored: {
    draft: RunSeries;
    validation: EditorValidationSummary;
    restoredBackupId: string;
  }): void;
}) {
  const [push, setPush] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [diff, setDiff] = useState<PublishDiffResponse | null>(null);
  const [diffBusy, setDiffBusy] = useState(false);
  const [backups, setBackups] = useState<EditorBackupSummary[]>([]);
  const [backupBusy, setBackupBusy] = useState(false);

  const publicEpisodes = series.runs.flatMap((run) =>
    run.episodes.filter((episode) => episode.status === "published"),
  );
  const draftEpisodeCount = series.runs.reduce(
    (count, run) => count + run.episodes.filter((episode) => episode.status === "draft").length,
    0,
  );
  const publicEpisodeIds = new Set(publicEpisodes.map((episode) => episode.id));
  const publicEvents = series.runs.flatMap((run) =>
    run.events.filter((event) => publicEpisodeIds.has(event.episodeId)),
  );

  async function refreshDiff() {
    setDiffBusy(true);
    try {
      setDiff(await previewPublishDiff(series));
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value));
    } finally {
      setDiffBusy(false);
    }
  }

  async function refreshBackups() {
    setBackupBusy(true);
    try {
      setBackups((await loadBackups()).backups);
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value));
    } finally {
      setBackupBusy(false);
    }
  }

  useEffect(() => {
    void refreshDiff();
  }, [series]);

  useEffect(() => {
    void refreshBackups();
  }, []);

  async function restoreBackup(backupId: string) {
    if (
      !confirm(
        "Load this published backup into your LOCAL DRAFT? Your current local draft will be replaced, but the public files will not change until you publish again.",
      )
    ) {
      return;
    }
    setBackupBusy(true);
    setError("");
    try {
      const restored = await restoreBackupToDraft(backupId);
      onRestoreDraft(restored);
      await refreshWorkspaceStatus();
      await refreshDiff();
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value));
    } finally {
      setBackupBusy(false);
    }
  }

  async function go() {
    setBusy(true);
    setError("");
    try {
      if (dirty && !(await save())) {
        throw new Error("The draft could not be saved, so publishing was stopped.");
      }
      const latestValidation = await validateDraft(series);
      setValidation(latestValidation);
      if (!latestValidation.valid) throw new Error("Fix validation errors before publishing.");
      const response = await publishDraft({
        push,
        ...(commitMessage.trim() ? { commitMessage: commitMessage.trim() } : {}),
      });
      onPublished(response.published);
      setMessage(
        `Published ${response.published.episodeCount} episodes / ${response.published.eventCount} events.${response.git.pushed ? " Committed and pushed." : " Public files written locally."} Backup created at ${response.backupPath}.`,
      );
      await Promise.all([refreshWorkspaceStatus(), refreshBackups(), refreshDiff()]);
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value));
    } finally {
      setBusy(false);
    }
  }

  const diffGroups = diff
    ? [diff.runs, diff.episodes, diff.events, diff.pokemon, diff.soulLinks, diff.rules, diff.tags]
    : [];
  const diffEntityChanges = diffGroups.reduce(
    (total, group) => total + group.added.length + group.changed.length + group.removed.length,
    0,
  );
  const noChanges = Boolean(diff && !diff.seriesChanged && diffEntityChanges === 0);

  return (
    <div className="editor-stack">
      <header className="editor-heading">
        <p>Final check</p>
        <h2>Preview, recover & publish</h2>
        <span>
          Only episodes marked Published can enter the public data folder. Every publish first
          snapshots the current public data.
        </span>
      </header>

      <ValidationCard validation={validation} />

      <section className="editor-card">
        <div className="card-heading">
          <div>
            <p>Draft preview</p>
            <h3>View the public UI with local draft data</h3>
          </div>
          <a
            className="button-link"
            href="http://127.0.0.1:5173/?preview=draft"
            target="_blank"
            rel="noreferrer"
          >
            Open preview ↗
          </a>
        </div>
        <p className="muted-copy">
          Use <code>npm run dev:authoring</code> so the site runs on 5173 and editor on 5174.
        </p>
      </section>

      <section className="editor-card">
        <div className="card-heading">
          <div>
            <p>Actual publish diff</p>
            <h3>Generated public subset vs. current public files</h3>
          </div>
          <button onClick={() => void refreshDiff()} disabled={diffBusy}>
            {diffBusy ? "Comparing…" : "Refresh diff"}
          </button>
        </div>
        <div className="publish-summary">
          <span>{publicEpisodes.length} published episodes</span>
          <span>{draftEpisodeCount} draft episodes excluded</span>
          <span>{publicEvents.length} public events</span>
        </div>
        {diff ? (
          <>
            <div className="publish-diff-grid">
              <article>
                <span>Series metadata</span>
                <strong>{diff.seriesChanged ? "Changed" : "Same"}</strong>
                <small>series.json</small>
              </article>
              <article>
                <span>Public runs</span>
                <strong>{diff.publicDataset.runCount}</strong>
                <small>attempts visible after draft stripping</small>
              </article>
              <article>
                <span>Public episodes</span>
                <strong>{diff.publicDataset.episodeCount}</strong>
                <small>episodes after draft stripping</small>
              </article>
              <article>
                <span>Public events</span>
                <strong>{diff.publicDataset.eventCount}</strong>
                <small>events after draft stripping</small>
              </article>
            </div>
            {noChanges ? (
              <p className="success-copy">No public changes are currently pending.</p>
            ) : null}
            <div className="publish-diff-details">
              <DiffList label="Runs" diff={diff.runs} />
              <DiffList label="Episodes" diff={diff.episodes} />
              <DiffList label="Events" diff={diff.events} />
              <DiffList label="Pokémon" diff={diff.pokemon} />
              <DiffList label="Soul Links" diff={diff.soulLinks} />
              <DiffList label="Rules" diff={diff.rules} />
              <DiffList label="Tags" diff={diff.tags} />
            </div>
          </>
        ) : (
          <p className="muted-copy">Diff not loaded yet.</p>
        )}
      </section>

      <section className="editor-card">
        <div className="card-heading">
          <div>
            <p>Recovery</p>
            <h3>Published backups</h3>
          </div>
          <button onClick={() => void refreshBackups()} disabled={backupBusy}>
            {backupBusy ? "Refreshing…" : "Refresh backups"}
          </button>
        </div>
        <p className="muted-copy">
          Restoring is intentionally two-step: a backup is loaded into the local draft first.
          Preview and validate it, then publish it only when you are satisfied.
        </p>
        <div className="backup-list">
          {backups.length ? (
            backups
              .slice(0, 12)
              .map((backup) => (
                <BackupCard
                  key={backup.id}
                  backup={backup}
                  disabled={backupBusy || busy}
                  onRestore={(id) => void restoreBackup(id)}
                />
              ))
          ) : (
            <p className="muted-copy">
              No published backups exist yet. The first publish will create one.
            </p>
          )}
        </div>
      </section>

      <section className="editor-card">
        <div className="card-heading">
          <div>
            <p>Workspace status</p>
            <h3>Git & public baseline</h3>
          </div>
          <button onClick={() => void refreshWorkspaceStatus()}>Refresh status</button>
        </div>
        <dl className="status-list">
          <div>
            <dt>Public baseline</dt>
            <dd>
              {bootstrap.published.runCount} runs / {bootstrap.published.episodeCount} episodes /{" "}
              {bootstrap.published.eventCount} events
            </dd>
          </div>
          <div>
            <dt>Git branch</dt>
            <dd>
              {bootstrap.git.available ? bootstrap.git.branch || "Available" : "Not detected"}
            </dd>
          </div>
          <div>
            <dt>Remote</dt>
            <dd>{bootstrap.git.remote || "—"}</dd>
          </div>
        </dl>
        {bootstrap.git.unrelatedDirtyPaths.length ? (
          <p className="warning-copy">
            Push blocked by unrelated changes: {bootstrap.git.unrelatedDirtyPaths.join(", ")}
          </p>
        ) : null}
      </section>

      <section className="editor-card">
        <label className="check-field check-field--publish">
          <input
            type="checkbox"
            checked={push}
            onChange={(event) => setPush(event.target.checked)}
            disabled={!bootstrap.git.available}
          />
          <span>
            <strong>Commit and push with Git</strong>
            <small>
              {bootstrap.git.available
                ? `Branch ${bootstrap.git.branch || "current"}; only content/published is staged.`
                : "Git repository not detected. Local publish still works."}
            </small>
          </span>
        </label>
        {push ? (
          <Field label="Commit message" hint="Optional">
            <input
              value={commitMessage}
              onChange={(event) => setCommitMessage(event.target.value)}
              placeholder="content: publish through episode …"
            />
          </Field>
        ) : null}
        <button
          className="button-primary button-large"
          disabled={
            busy || !validation.valid || (push && bootstrap.git.unrelatedDirtyPaths.length > 0)
          }
          onClick={() => void go()}
        >
          {busy ? "Publishing…" : push ? "Publish, commit & push" : "Publish to public files"}
        </button>
      </section>
    </div>
  );
}
