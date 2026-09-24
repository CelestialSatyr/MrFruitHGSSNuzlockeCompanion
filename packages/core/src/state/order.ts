import type { RunDataset } from "../schemas/dataset.ts";
import type { Episode } from "../schemas/episode.ts";
import type { RunEvent } from "../schemas/events.ts";
import type { RunCutoff } from "./types.ts";

export interface OrderedRunEvent {
  event: RunEvent;
  episode: Episode;
}

export function getOrderedRunEvents(
  dataset: RunDataset,
  options: {
    cutoff?: RunCutoff | undefined;
    episodeStatus?: "all" | "published" | undefined;
  } = {},
): OrderedRunEvent[] {
  const episodeStatus = options.episodeStatus ?? "all";
  const cutoff = options.cutoff ?? { kind: "all" };
  const episodeById = new Map(dataset.episodes.map((episode) => [episode.id, episode]));

  const ordered = dataset.events
    .map((event): OrderedRunEvent | undefined => {
      const episode = episodeById.get(event.episodeId);
      if (episode === undefined) return undefined;
      if (episodeStatus === "published" && episode.status !== "published") return undefined;
      return { event, episode };
    })
    .filter((entry): entry is OrderedRunEvent => entry !== undefined)
    .sort(compareOrderedEvents);

  if (cutoff.kind === "all") return ordered;

  if (cutoff.kind === "episode") {
    return ordered.filter((entry) => entry.episode.number <= cutoff.episodeNumber);
  }

  const cutoffIndex = ordered.findIndex((entry) => entry.event.id === cutoff.eventId);
  if (cutoffIndex < 0) return [];
  return ordered.slice(0, cutoffIndex + 1);
}

export function compareOrderedEvents(left: OrderedRunEvent, right: OrderedRunEvent): number {
  if (left.episode.number !== right.episode.number) {
    return left.episode.number - right.episode.number;
  }
  if (left.event.sequence !== right.event.sequence) {
    return left.event.sequence - right.event.sequence;
  }
  return left.event.id.localeCompare(right.event.id);
}
