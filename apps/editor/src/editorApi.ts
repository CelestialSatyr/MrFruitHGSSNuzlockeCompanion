import type { RunSeries } from "@nuzlocke/core";
import type {
  BackupsResponse,
  EditorBootstrapResponse,
  EditorSaveResponse,
  EditorValidationSummary,
  PokemonAbilityOption,
  PokemonSpeciesOption,
  PublishDiffResponse,
  PublishRequest,
  PublishResponse,
  RestoreBackupResponse,
  YouTubeChannelProfileResponse,
  YouTubeImportResponse,
} from "../shared/api-types";

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? `Editor request failed (${response.status}).`);
  return payload;
}

export const loadEditorBootstrap = () =>
  requestJson<EditorBootstrapResponse>("/api/editor/bootstrap");
export const saveDraft = (series: RunSeries) =>
  requestJson<EditorSaveResponse>("/api/editor/draft", {
    method: "PUT",
    body: JSON.stringify(series),
  });
export const resetDraft = () =>
  requestJson<EditorSaveResponse>("/api/editor/reset-draft", { method: "POST", body: "{}" });
export const validateDraft = (series: RunSeries) =>
  requestJson<EditorValidationSummary>("/api/editor/validate", {
    method: "POST",
    body: JSON.stringify(series),
  });
export const importYouTube = (url: string) =>
  requestJson<YouTubeImportResponse>("/api/editor/youtube", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
export const importYouTubeChannel = (url: string) =>
  requestJson<YouTubeChannelProfileResponse>("/api/editor/youtube-channel", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
export const publishDraft = (request: PublishRequest) =>
  requestJson<PublishResponse>("/api/editor/publish", {
    method: "POST",
    body: JSON.stringify(request),
  });
export const previewPublishDiff = (series: RunSeries) =>
  requestJson<PublishDiffResponse>("/api/editor/publish-preview", {
    method: "POST",
    body: JSON.stringify(series),
  });
export const loadBackups = () => requestJson<BackupsResponse>("/api/editor/backups");
export const restoreBackupToDraft = (backupId: string) =>
  requestJson<RestoreBackupResponse>("/api/editor/restore-backup", {
    method: "POST",
    body: JSON.stringify({ backupId }),
  });
export const loadSpeciesCatalog = () =>
  requestJson<{ species: PokemonSpeciesOption[] }>("/api/editor/species");
export const loadAbilityCatalog = () =>
  requestJson<{ abilities: PokemonAbilityOption[] }>("/api/editor/abilities");
