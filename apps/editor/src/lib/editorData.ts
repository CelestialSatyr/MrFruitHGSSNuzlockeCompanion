import type { Episode, RunDataset, RunEvent, RunSeries } from "@nuzlocke/core";

export function nextOpaqueId(prefix: "ep" | "evt" | "pkm" | "link", ids: readonly string[]) {
  const pattern = new RegExp(`^${prefix}_(\\d+)$`);
  const max = ids.reduce((current, id) => {
    const match = pattern.exec(id);
    return match ? Math.max(current, Number(match[1])) : current;
  }, 0);
  return `${prefix}_${String(max + 1).padStart(4, "0")}`;
}

export function nextEpisode(dataset: RunDataset, series?: RunSeries): Episode {
  const allEpisodes = series ? series.runs.flatMap((run) => run.episodes) : dataset.episodes;
  const number = allEpisodes.reduce((current, episode) => Math.max(current, episode.number), 0) + 1;
  const id = nextOpaqueId(
    "ep",
    allEpisodes.map((episode) => episode.id),
  ) as Episode["id"];
  return { id, number, status: "draft" };
}

export function nextEventSequence(events: readonly RunEvent[], episodeId: string) {
  const max = events
    .filter((event) => event.episodeId === episodeId)
    .reduce((current, event) => Math.max(current, event.sequence), 0);
  return max === 0 ? 10 : Math.ceil((max + 1) / 10) * 10;
}

export function normalizeEpisodeEventOrder(
  dataset: RunDataset,
  episodeId: string,
  orderedEventIds: readonly string[],
): RunDataset {
  const orderById = new Map(orderedEventIds.map((id, index) => [id, (index + 1) * 10]));
  return {
    ...dataset,
    events: dataset.events.map((event) =>
      event.episodeId === episodeId && orderById.has(event.id)
        ? { ...event, sequence: orderById.get(event.id)! }
        : event,
    ),
  } as RunDataset;
}

export function parseTimestampInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const parts = trimmed.split(":").map(Number);
  if (parts.some((part) => !Number.isFinite(part) || part < 0)) return undefined;
  if (parts.length === 2) return parts[0]! * 60 + parts[1]!;
  if (parts.length === 3) return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
  return undefined;
}

export function formatTimestampInput(seconds: number | undefined) {
  if (seconds === undefined) return "";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`
    : `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

export function episodeLabel(dataset: RunDataset, id: string) {
  const episode = dataset.episodes.find((entry) => entry.id === id);
  return episode
    ? `Episode ${episode.number}${episode.titleOverride ? ` · ${episode.titleOverride}` : ""}`
    : id;
}
