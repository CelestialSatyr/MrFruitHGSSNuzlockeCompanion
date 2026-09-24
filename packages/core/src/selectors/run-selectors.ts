import type { RunDataset } from "../schemas/dataset.ts";
import type { RunEvent } from "../schemas/events.ts";
import type { PlayerId, PokemonId, SoulLinkId } from "../schemas/identifiers.ts";
import type { PokemonState, RunState, SoulLinkState } from "../state/types.ts";

export function selectPokemonHistory<TGameState>(
  dataset: RunDataset,
  state: RunState<TGameState>,
  pokemonId: PokemonId,
): RunEvent[] {
  const pokemon = state.pokemon.get(pokemonId);
  if (pokemon === undefined) return [];
  return eventsFromIds(dataset, pokemon.historyEventIds);
}

export function selectSoulLinkHistory<TGameState>(
  dataset: RunDataset,
  state: RunState<TGameState>,
  soulLinkId: SoulLinkId,
): RunEvent[] {
  const link = state.soulLinks.get(soulLinkId);
  if (link === undefined) return [];
  return eventsFromIds(dataset, link.historyEventIds);
}

export function selectPartyForPlayer<TGameState>(
  state: RunState<TGameState>,
  playerId: PlayerId,
): PokemonState[] {
  return [...state.pokemon.values()].filter(
    (pokemon) =>
      pokemon.playerId === playerId &&
      pokemon.lifeStatus === "alive" &&
      pokemon.placement === "party",
  );
}

export function selectActiveSoulLinks<TGameState>(state: RunState<TGameState>): SoulLinkState[] {
  return [...state.soulLinks.values()].filter((link) => link.status === "active");
}

export function selectLostSoulLinks<TGameState>(state: RunState<TGameState>): SoulLinkState[] {
  return [...state.soulLinks.values()].filter((link) => link.status === "lost");
}

export function selectRetiredSoulLinks<TGameState>(state: RunState<TGameState>): SoulLinkState[] {
  return [...state.soulLinks.values()].filter((link) => link.status === "retired");
}

export function selectHighlights<TGameState>(
  dataset: RunDataset,
  state: RunState<TGameState>,
): RunEvent[] {
  const eventById = new Map(dataset.events.map((event) => [event.id, event]));
  return state.processedEventIds
    .map((eventId) => eventById.get(eventId))
    .filter((event): event is RunEvent => event !== undefined)
    .filter(
      (event) =>
        event.importance === "major" ||
        event.type === "special-moment" ||
        event.presentation?.featured === true ||
        event.visibility?.highlights === true,
    );
}

function eventsFromIds(dataset: RunDataset, eventIds: readonly string[]): RunEvent[] {
  const eventById = new Map(dataset.events.map((event) => [event.id, event]));
  return eventIds
    .map((eventId) => eventById.get(eventId))
    .filter((event): event is RunEvent => event !== undefined);
}

export interface TimelineEpisodeGroup {
  episode: RunDataset["episodes"][number];
  events: RunEvent[];
}

export function selectTimelineEpisodeGroups<TGameState>(
  dataset: RunDataset,
  state: RunState<TGameState>,
  order: "chronological" | "newest-first" = "newest-first",
): TimelineEpisodeGroup[] {
  const visibleEventIds = new Set(state.processedEventIds);
  const eventsByEpisode = new Map<string, RunEvent[]>();

  for (const event of dataset.events) {
    if (!visibleEventIds.has(event.id)) continue;
    const events = eventsByEpisode.get(event.episodeId) ?? [];
    events.push(event);
    eventsByEpisode.set(event.episodeId, events);
  }

  const groups = dataset.episodes
    .filter((episode) => eventsByEpisode.has(episode.id))
    .map((episode) => ({
      episode,
      events: [...(eventsByEpisode.get(episode.id) ?? [])].sort(
        (left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id),
      ),
    }))
    .sort((left, right) => left.episode.number - right.episode.number);

  return order === "newest-first" ? groups.reverse() : groups;
}
