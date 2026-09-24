import type { Episode } from "../schemas/episode.ts";
import type { RunCutoff } from "./types.ts";

export type SpoilerMode = "hide-latest" | "show-all" | "episode";

export interface SpoilerPreference {
  mode: SpoilerMode;
  episodeNumber?: number | undefined;
}

export interface ResolvedSpoilerState {
  mode: SpoilerMode;
  latestPublishedEpisodeNumber: number;
  visibleThroughEpisodeNumber: number;
  cutoff: RunCutoff;
}

export function resolveSpoilerState(
  episodes: readonly Episode[],
  preference: SpoilerPreference,
): ResolvedSpoilerState {
  const latestPublishedEpisodeNumber = getLatestPublishedEpisodeNumber(episodes);
  let visibleThroughEpisodeNumber: number;

  switch (preference.mode) {
    case "show-all":
      visibleThroughEpisodeNumber = latestPublishedEpisodeNumber;
      break;
    case "episode":
      visibleThroughEpisodeNumber = clampEpisode(
        preference.episodeNumber ?? 0,
        latestPublishedEpisodeNumber,
      );
      break;
    case "hide-latest":
      visibleThroughEpisodeNumber = Math.max(0, latestPublishedEpisodeNumber - 1);
      break;
  }

  return {
    mode: preference.mode,
    latestPublishedEpisodeNumber,
    visibleThroughEpisodeNumber,
    cutoff: { kind: "episode", episodeNumber: visibleThroughEpisodeNumber },
  };
}

export function getLatestPublishedEpisodeNumber(episodes: readonly Episode[]): number {
  return episodes.reduce(
    (latest, episode) =>
      episode.status === "published" ? Math.max(latest, episode.number) : latest,
    0,
  );
}

function clampEpisode(requested: number, latest: number): number {
  if (!Number.isFinite(requested)) return 0;
  return Math.max(0, Math.min(Math.trunc(requested), latest));
}
