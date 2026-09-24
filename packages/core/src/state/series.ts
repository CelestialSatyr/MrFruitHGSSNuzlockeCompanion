import type { RunDataset } from "../schemas/dataset.ts";
import type { Episode } from "../schemas/episode.ts";
import type { RunSeries } from "../schemas/series.ts";

export type SeriesEpisodeStatus = "all" | "published";

export function getSeriesEpisodes(
  series: RunSeries,
  episodeStatus: SeriesEpisodeStatus = "published",
): Episode[] {
  return series.runs
    .flatMap((dataset) =>
      episodeStatus === "all"
        ? dataset.episodes
        : dataset.episodes.filter((episode) => episode.status === "published"),
    )
    .sort((a, b) => a.number - b.number);
}

export function getVisibleSeriesRuns(
  series: RunSeries,
  visibleThroughEpisode: number,
  episodeStatus: SeriesEpisodeStatus = "published",
): RunDataset[] {
  return series.runs
    .filter((dataset) => {
      const episodes =
        episodeStatus === "all"
          ? dataset.episodes
          : dataset.episodes.filter((episode) => episode.status === "published");
      return episodes.some((episode) => episode.number <= visibleThroughEpisode);
    })
    .sort((left, right) => {
      const leftFirst = Math.min(...left.episodes.map((episode) => episode.number));
      const rightFirst = Math.min(...right.episodes.map((episode) => episode.number));
      return leftFirst - rightFirst;
    });
}

export function getRunVisibleEpisodeBounds(
  dataset: RunDataset,
  visibleThroughEpisode: number,
  episodeStatus: SeriesEpisodeStatus = "published",
): { first: number; last: number } | undefined {
  const episodes = (
    episodeStatus === "all"
      ? dataset.episodes
      : dataset.episodes.filter((episode) => episode.status === "published")
  )
    .filter((episode) => episode.number <= visibleThroughEpisode)
    .sort((a, b) => a.number - b.number);
  if (!episodes.length) return undefined;
  return { first: episodes[0]!.number, last: episodes.at(-1)!.number };
}
