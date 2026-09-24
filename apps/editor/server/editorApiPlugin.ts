import type { IncomingMessage, ServerResponse } from "node:http";
import { parseRunSeries, type RunSeries } from "@nuzlocke/core";
import type { Plugin } from "vite";
import {
  backupPublishedDataset,
  createEditorPaths,
  createPublicSeries,
  createPublishDiff,
  listPublishedBackups,
  readOrCreateDraft,
  readPublishedSeries,
  restoreBackupIntoDraft,
  validateSeries,
  writeDraftSeries,
  writePublishedSeries,
} from "./repository.ts";
import { commitAndPushPublished, getGitStatus } from "./git.ts";
import { importYouTubeMetadata } from "./youtube.ts";
import { importYouTubeChannelProfile } from "./youtube-channel.ts";
import { loadSpeciesCatalog } from "./species.ts";
import { loadAbilityCatalog } from "./abilities.ts";
import type { PublishRequest } from "../shared/api-types.ts";

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(value));
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return chunks.length ? (JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown) : {};
}

function isAllowedBrowserOrigin(request: IncomingMessage, route: string): boolean {
  const origin = request.headers.origin;
  if (!origin) return true;
  if (origin === "http://127.0.0.1:5174" || origin === "http://localhost:5174") return true;
  return (
    route === "/api/editor/draft-dataset" &&
    request.method === "GET" &&
    (origin === "http://127.0.0.1:5173" || origin === "http://localhost:5173")
  );
}

function allowPreviewCors(request: IncomingMessage, response: ServerResponse): void {
  const origin = request.headers.origin;
  if (origin === "http://127.0.0.1:5173" || origin === "http://localhost:5173") {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }
}

function parseDraftForPreview(input: unknown): RunSeries {
  return parseRunSeries(input);
}

export function editorApiPlugin(options: { repoRoot: string; youtubeApiKey?: string }): Plugin {
  const paths = createEditorPaths(options.repoRoot);

  return {
    name: "nuzlocke-editor-local-api",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (!request.url?.startsWith("/api/editor/")) {
          next();
          return;
        }

        const route = new URL(request.url, "http://127.0.0.1").pathname;
        if (!isAllowedBrowserOrigin(request, route)) {
          sendJson(response, 403, { error: "The local editor API rejected this browser origin." });
          return;
        }

        allowPreviewCors(request, response);
        if (request.method === "OPTIONS") {
          response.statusCode = 204;
          response.end();
          return;
        }

        try {
          if (route === "/api/editor/bootstrap" && request.method === "GET") {
            const [{ dataset: draft, existed }, published, git] = await Promise.all([
              readOrCreateDraft(paths),
              readPublishedSeries(paths),
              getGitStatus(paths.repoRoot),
            ]);
            sendJson(response, 200, {
              draft,
              validation: validateSeries(draft),
              draftExists: existed,
              youtubeConfigured: Boolean(options.youtubeApiKey),
              git,
              published: {
                runCount: published.runs.length,
                episodeCount: published.runs.reduce(
                  (count, dataset) => count + dataset.episodes.length,
                  0,
                ),
                eventCount: published.runs.reduce(
                  (count, dataset) => count + dataset.events.length,
                  0,
                ),
                pokemonCount: published.runs.reduce(
                  (count, dataset) => count + dataset.pokemon.length,
                  0,
                ),
                soulLinkCount: published.runs.reduce(
                  (count, dataset) => count + dataset.soulLinks.length,
                  0,
                ),
              },
            });
            return;
          }

          if (route === "/api/editor/draft-dataset" && request.method === "GET") {
            sendJson(response, 200, (await readOrCreateDraft(paths)).dataset);
            return;
          }

          if (route === "/api/editor/draft" && request.method === "PUT") {
            const draft = await writeDraftSeries(paths, await readBody(request));
            sendJson(response, 200, {
              draft,
              validation: validateSeries(draft),
              savedAt: new Date().toISOString(),
            });
            return;
          }

          if (route === "/api/editor/reset-draft" && request.method === "POST") {
            const draft = await writeDraftSeries(paths, await readPublishedSeries(paths));
            sendJson(response, 200, {
              draft,
              validation: validateSeries(draft),
              savedAt: new Date().toISOString(),
            });
            return;
          }

          if (route === "/api/editor/validate" && request.method === "POST") {
            sendJson(response, 200, validateSeries(await readBody(request)));
            return;
          }

          if (route === "/api/editor/species" && request.method === "GET") {
            sendJson(response, 200, { species: await loadSpeciesCatalog(paths.repoRoot) });
            return;
          }

          if (route === "/api/editor/abilities" && request.method === "GET") {
            sendJson(response, 200, { abilities: await loadAbilityCatalog(paths.repoRoot) });
            return;
          }

          if (route === "/api/editor/publish-preview" && request.method === "POST") {
            const input = parseDraftForPreview(await readBody(request));
            const currentPublished = await readPublishedSeries(paths);
            const nextPublic = createPublicSeries(input);
            sendJson(response, 200, createPublishDiff(currentPublished, nextPublic));
            return;
          }

          if (route === "/api/editor/backups" && request.method === "GET") {
            sendJson(response, 200, { backups: await listPublishedBackups(paths) });
            return;
          }

          if (route === "/api/editor/restore-backup" && request.method === "POST") {
            const input = (await readBody(request)) as { backupId?: unknown };
            if (typeof input.backupId !== "string")
              throw new Error("A backup identifier is required.");
            const draft = await restoreBackupIntoDraft(paths, input.backupId);
            sendJson(response, 200, {
              draft,
              validation: validateSeries(draft),
              restoredBackupId: input.backupId,
            });
            return;
          }

          if (route === "/api/editor/youtube-channel" && request.method === "POST") {
            const input = (await readBody(request)) as { url?: unknown };
            if (typeof input.url !== "string")
              throw new Error("A YouTube channel URL is required.");
            sendJson(
              response,
              200,
              await importYouTubeChannelProfile(input.url, options.youtubeApiKey),
            );
            return;
          }

          if (route === "/api/editor/youtube" && request.method === "POST") {
            const input = (await readBody(request)) as { url?: unknown };
            if (typeof input.url !== "string") throw new Error("A YouTube URL is required.");
            sendJson(response, 200, {
              metadata: await importYouTubeMetadata(input.url, options.youtubeApiKey),
            });
            return;
          }

          if (route === "/api/editor/publish" && request.method === "POST") {
            const publishRequest = (await readBody(request)) as PublishRequest;
            const draft = (await readOrCreateDraft(paths)).dataset;
            const draftValidation = validateSeries(draft);
            if (!draftValidation.valid) {
              sendJson(response, 409, {
                error: "Draft validation failed. Fix all errors before publishing.",
                validation: draftValidation,
              });
              return;
            }

            const publicDataset = createPublicSeries(draft);
            const publicValidation = validateSeries(publicDataset);
            if (!publicValidation.valid) {
              sendJson(response, 409, {
                error:
                  "The public subset would be invalid. A published episode probably references draft-only data.",
                validation: publicValidation,
              });
              return;
            }

            const gitStatus = await getGitStatus(paths.repoRoot);
            if (
              publishRequest.push &&
              (!gitStatus.available || gitStatus.unrelatedDirtyPaths.length > 0)
            ) {
              sendJson(response, 409, {
                error: gitStatus.available
                  ? `Git publishing is blocked by unrelated working-tree changes: ${gitStatus.unrelatedDirtyPaths.join(", ")}`
                  : "This checkout is not an available Git working tree.",
                git: gitStatus,
              });
              return;
            }

            const backupPath = await backupPublishedDataset(paths);
            await writePublishedSeries(paths, publicDataset);

            let committed = false;
            let pushed = false;
            let commitMessage: string | undefined;
            if (publishRequest.push) {
              const latestEpisode = publicDataset.runs
                .flatMap((dataset) => dataset.episodes)
                .reduce((max, episode) => Math.max(max, episode.number), 0);
              commitMessage =
                publishRequest.commitMessage?.trim() ||
                `content: publish through episode ${latestEpisode}`;
              ({ committed, pushed } = await commitAndPushPublished(paths.repoRoot, commitMessage));
            }

            sendJson(response, 200, {
              published: {
                runCount: publicDataset.runs.length,
                episodeCount: publicDataset.runs.reduce(
                  (count, dataset) => count + dataset.episodes.length,
                  0,
                ),
                eventCount: publicDataset.runs.reduce(
                  (count, dataset) => count + dataset.events.length,
                  0,
                ),
                pokemonCount: publicDataset.runs.reduce(
                  (count, dataset) => count + dataset.pokemon.length,
                  0,
                ),
                soulLinkCount: publicDataset.runs.reduce(
                  (count, dataset) => count + dataset.soulLinks.length,
                  0,
                ),
              },
              backupPath,
              git: {
                attempted: Boolean(publishRequest.push),
                committed,
                pushed,
                ...(commitMessage ? { commitMessage } : {}),
              },
            });
            return;
          }

          sendJson(response, 404, { error: "Unknown local editor API route." });
        } catch (error) {
          sendJson(response, 500, {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });
    },
  };
}
