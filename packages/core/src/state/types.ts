import type {
  EncounterOpportunityId,
  EpisodeId,
  EventId,
  LocationId,
  PlayerId,
  PokemonId,
  SoulLinkId,
} from "../schemas/identifiers.ts";
import type { Pokemon } from "../schemas/pokemon.ts";
import type { SoulLink } from "../schemas/soul-link.ts";

export type PokemonLifeStatus = "alive" | "dead" | "retired" | "retired-by-link";
export type PokemonPlacement = "unknown" | "party" | "box" | "retired";
export type SoulLinkStatus = "active" | "lost" | "retired";
export type EncounterResolutionStatus = "caught" | "failed" | "skipped";

export interface PokemonDeathState {
  eventId: EventId;
  cause: string;
}

export interface PokemonRetirementState {
  eventId: EventId;
  reason: "manual" | "soul-link";
  triggeredByPokemonId: PokemonId | undefined;
}

export interface PokemonState {
  id: PokemonId;
  playerId: PlayerId;
  source: Pokemon;
  createdByEventId: EventId;
  soulLinkId: SoulLinkId | undefined;
  currentSpeciesId: number;
  currentNickname: string | undefined;
  currentFormId: string | undefined;
  currentLevel: number | undefined;
  knownMoveIds: string[];
  heldItemId: string | undefined;
  abilityId: string | undefined;
  natureId: string | undefined;
  lifeStatus: PokemonLifeStatus;
  placement: PokemonPlacement;
  death: PokemonDeathState | undefined;
  retirement: PokemonRetirementState | undefined;
  historyEventIds: EventId[];
}

export interface SoulLinkEndState {
  eventId: EventId;
  reason: "death" | "manual-retirement";
  triggeredByPokemonId: PokemonId;
}

export interface SoulLinkState {
  id: SoulLinkId;
  source: SoulLink;
  pokemonIds: readonly [PokemonId, PokemonId];
  createdByEventId: EventId;
  status: SoulLinkStatus;
  ended: SoulLinkEndState | undefined;
  historyEventIds: EventId[];
}

export interface EncounterResolutionState {
  key: string;
  eventId: EventId;
  episodeId: EpisodeId;
  locationId: LocationId;
  opportunityId: EncounterOpportunityId;
  status: EncounterResolutionStatus;
  soulLinkId: SoulLinkId | undefined;
}

export interface RunState<TGameState = undefined> {
  throughEventId: EventId | undefined;
  throughEpisodeNumber: number | undefined;
  processedEventIds: readonly EventId[];
  pokemon: ReadonlyMap<PokemonId, PokemonState>;
  soulLinks: ReadonlyMap<SoulLinkId, SoulLinkState>;
  encounters: ReadonlyMap<string, EncounterResolutionState>;
  earnedBadgeIds: ReadonlySet<string>;
  game: TGameState;
}

export interface MutableRunState<TGameState = undefined> {
  throughEventId: EventId | undefined;
  throughEpisodeNumber: number | undefined;
  processedEventIds: EventId[];
  pokemon: Map<PokemonId, PokemonState>;
  soulLinks: Map<SoulLinkId, SoulLinkState>;
  encounters: Map<string, EncounterResolutionState>;
  earnedBadgeIds: Set<string>;
  game: TGameState;
}

export interface GameStateAdapter<TGameState> {
  readonly gameId: string;
  createInitialState(): TGameState;
  applyEvent(state: TGameState, event: import("../schemas/events.ts").RunEvent): void;
  validateProgressionFlag?(flag: {
    kind: "badge" | "capability" | "milestone";
    id: string;
  }): boolean;
}

export type RunCutoff =
  | { kind: "all" }
  | { kind: "episode"; episodeNumber: number }
  | { kind: "event"; eventId: EventId };

export interface ReconstructionOptions<TGameState = undefined> {
  cutoff?: RunCutoff | undefined;
  episodeStatus?: "all" | "published" | undefined;
  gameAdapter?: GameStateAdapter<TGameState> | undefined;
}

export function encounterResolutionKey(
  locationId: LocationId,
  opportunityId: EncounterOpportunityId,
): string {
  return `${locationId}::${opportunityId}`;
}
