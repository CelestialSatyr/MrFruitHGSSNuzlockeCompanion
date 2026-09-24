import type { RunDataset } from "../schemas/dataset.ts";
import type { RunEvent } from "../schemas/events.ts";
import type { EventId, PokemonId, SoulLinkId } from "../schemas/identifiers.ts";
import { getEventReferences } from "./event-references.ts";
import {
  encounterResolutionKey,
  type GameStateAdapter,
  type MutableRunState,
  type PokemonPlacement,
  type PokemonState,
} from "./types.ts";

export interface RunStateBuildContext<TGameState> {
  dataset: RunDataset;
  pokemonById: Map<string, RunDataset["pokemon"][number]>;
  soulLinkById: Map<string, RunDataset["soulLinks"][number]>;
  gameAdapter: GameStateAdapter<TGameState> | undefined;
}

export function createRunStateBuildContext<TGameState>(
  dataset: RunDataset,
  gameAdapter?: GameStateAdapter<TGameState>,
): RunStateBuildContext<TGameState> {
  return {
    dataset,
    pokemonById: new Map(dataset.pokemon.map((pokemon) => [pokemon.id, pokemon])),
    soulLinkById: new Map(dataset.soulLinks.map((link) => [link.id, link])),
    gameAdapter,
  };
}

export function createInitialMutableRunState<TGameState>(
  gameAdapter?: GameStateAdapter<TGameState>,
): MutableRunState<TGameState | undefined> {
  return {
    throughEventId: undefined,
    throughEpisodeNumber: undefined,
    processedEventIds: [],
    pokemon: new Map(),
    soulLinks: new Map(),
    encounters: new Map(),
    earnedBadgeIds: new Set(),
    game: gameAdapter?.createInitialState(),
  };
}

export function applyRunEvent<TGameState>(
  state: MutableRunState<TGameState | undefined>,
  event: RunEvent,
  episodeNumber: number,
  context: RunStateBuildContext<TGameState>,
): void {
  switch (event.type) {
    case "encounter":
      applyEncounter(state, event, context);
      break;
    case "nickname-changed": {
      const pokemon = state.pokemon.get(event.pokemonId);
      if (pokemon !== undefined) pokemon.currentNickname = event.toNickname;
      break;
    }
    case "evolution": {
      const pokemon = state.pokemon.get(event.pokemonId);
      if (pokemon !== undefined) {
        pokemon.currentSpeciesId = event.toSpeciesId;
        if (event.level !== undefined) pokemon.currentLevel = event.level;
      }
      break;
    }
    case "party-changed":
      applyPartyChange(state, event.pokemonIds, event.to, event.id);
      break;
    case "level-milestone": {
      const pokemon = state.pokemon.get(event.pokemonId);
      if (pokemon !== undefined) pokemon.currentLevel = event.level;
      break;
    }
    case "move-changed": {
      const pokemon = state.pokemon.get(event.pokemonId);
      if (pokemon !== undefined) {
        if (event.forgottenMoveId !== undefined) {
          pokemon.knownMoveIds = pokemon.knownMoveIds.filter(
            (moveId) => moveId !== event.forgottenMoveId,
          );
        }
        if (
          event.learnedMoveId !== undefined &&
          !pokemon.knownMoveIds.includes(event.learnedMoveId)
        ) {
          pokemon.knownMoveIds.push(event.learnedMoveId);
        }
      }
      break;
    }
    case "held-item-changed": {
      const pokemon = state.pokemon.get(event.pokemonId);
      if (pokemon !== undefined) pokemon.heldItemId = event.toItemId;
      break;
    }
    case "ability-changed": {
      const pokemon = state.pokemon.get(event.pokemonId);
      if (pokemon !== undefined) pokemon.abilityId = event.toAbilityId;
      break;
    }
    case "form-changed": {
      const pokemon = state.pokemon.get(event.pokemonId);
      if (pokemon !== undefined) pokemon.currentFormId = event.toFormId;
      break;
    }
    case "gym-battle":
      if (event.result === "win" && event.badgeId !== undefined) {
        state.earnedBadgeIds.add(event.badgeId);
      }
      break;
    case "pokemon-death":
      applyPokemonDeath(state, event.pokemonId, event.id, event.cause);
      break;
    case "pokemon-revived": {
      const pokemon = state.pokemon.get(event.pokemonId);
      if (pokemon !== undefined) {
        pokemon.lifeStatus = "alive";
        pokemon.placement = "box";
        pokemon.death = undefined;
        pokemon.retirement = undefined;
      }
      break;
    }
    case "major-battle":
    case "progression-changed":
    case "special-moment":
    case "rule-ruling":
    case "custom":
      break;
  }

  if (context.gameAdapter !== undefined && state.game !== undefined) {
    context.gameAdapter.applyEvent(state.game, event);
  }

  recordEventHistory(state, event);
  state.processedEventIds.push(event.id);
  state.throughEventId = event.id;
  state.throughEpisodeNumber = episodeNumber;
}

function applyEncounter<TGameState>(
  state: MutableRunState<TGameState | undefined>,
  event: Extract<RunEvent, { type: "encounter" }>,
  context: RunStateBuildContext<TGameState>,
): void {
  const caught = event.outcomes.filter(
    (outcome): outcome is Extract<(typeof event.outcomes)[number], { result: "caught" }> =>
      outcome.result === "caught",
  );

  for (const outcome of caught) {
    const source = context.pokemonById.get(outcome.pokemonId);
    if (source === undefined || state.pokemon.has(outcome.pokemonId)) continue;

    state.pokemon.set(outcome.pokemonId, {
      id: outcome.pokemonId,
      playerId: outcome.playerId,
      source,
      createdByEventId: event.id,
      soulLinkId: event.soulLinkId,
      currentSpeciesId: outcome.speciesId,
      currentNickname: outcome.nickname,
      currentFormId: source.initialFormId,
      currentLevel: outcome.level,
      knownMoveIds: [],
      heldItemId: undefined,
      abilityId: source.initialAbilityId,
      natureId: source.natureId,
      lifeStatus: "alive",
      placement: outcome.placement ?? "unknown",
      death: undefined,
      retirement: undefined,
      historyEventIds: [],
    });
  }

  if (event.soulLinkId !== undefined && caught.length === 2) {
    const source = context.soulLinkById.get(event.soulLinkId);
    if (source !== undefined && !state.soulLinks.has(event.soulLinkId)) {
      state.soulLinks.set(event.soulLinkId, {
        id: event.soulLinkId,
        source,
        pokemonIds: source.pokemonIds,
        createdByEventId: event.id,
        status: "active",
        ended: undefined,
        historyEventIds: [],
      });
    }
  }

  const statuses = event.outcomes.map((outcome) => outcome.result);
  const status = statuses.every((result) => result === "caught")
    ? "caught"
    : statuses.some((result) => result === "failed")
      ? "failed"
      : "skipped";

  state.encounters.set(encounterResolutionKey(event.locationId, event.opportunityId), {
    key: encounterResolutionKey(event.locationId, event.opportunityId),
    eventId: event.id,
    episodeId: event.episodeId,
    locationId: event.locationId,
    opportunityId: event.opportunityId,
    status,
    soulLinkId: event.soulLinkId,
  });
}

function applyPartyChange<TGameState>(
  state: MutableRunState<TGameState | undefined>,
  pokemonIds: PokemonId[],
  to: PokemonPlacement | "retired",
  eventId: EventId,
): void {
  for (const pokemonId of pokemonIds) {
    const pokemon = state.pokemon.get(pokemonId);
    if (pokemon === undefined) continue;

    if (to !== "retired") {
      pokemon.placement = to;
      continue;
    }

    if (pokemon.lifeStatus === "alive") {
      pokemon.lifeStatus = "retired";
      pokemon.placement = "retired";
      pokemon.retirement = {
        eventId,
        reason: "manual",
        triggeredByPokemonId: pokemon.id,
      };
      retireSoulLinkFromManualRetirement(state, pokemon, eventId);
    }
  }
}

function retireSoulLinkFromManualRetirement<TGameState>(
  state: MutableRunState<TGameState | undefined>,
  pokemon: PokemonState,
  eventId: EventId,
): void {
  if (pokemon.soulLinkId === undefined) return;
  const link = state.soulLinks.get(pokemon.soulLinkId);
  if (link === undefined || link.status !== "active") return;

  link.status = "retired";
  link.ended = {
    eventId,
    reason: "manual-retirement",
    triggeredByPokemonId: pokemon.id,
  };

  const partnerId = otherPokemonId(link.pokemonIds, pokemon.id);
  const partner = state.pokemon.get(partnerId);
  if (partner !== undefined && partner.lifeStatus === "alive") {
    partner.lifeStatus = "retired-by-link";
    partner.placement = "retired";
    partner.retirement = {
      eventId,
      reason: "soul-link",
      triggeredByPokemonId: pokemon.id,
    };
  }
}

function applyPokemonDeath<TGameState>(
  state: MutableRunState<TGameState | undefined>,
  pokemonId: PokemonId,
  eventId: EventId,
  cause: string,
): void {
  const pokemon = state.pokemon.get(pokemonId);
  if (pokemon === undefined) return;

  pokemon.lifeStatus = "dead";
  pokemon.placement = "retired";
  pokemon.death = { eventId, cause };
  pokemon.retirement = undefined;

  if (pokemon.soulLinkId === undefined) return;
  const link = state.soulLinks.get(pokemon.soulLinkId);
  if (link === undefined || link.status !== "active") return;

  link.status = "lost";
  link.ended = {
    eventId,
    reason: "death",
    triggeredByPokemonId: pokemon.id,
  };

  const partnerId = otherPokemonId(link.pokemonIds, pokemon.id);
  const partner = state.pokemon.get(partnerId);
  if (partner !== undefined && partner.lifeStatus === "alive") {
    partner.lifeStatus = "retired-by-link";
    partner.placement = "retired";
    partner.retirement = {
      eventId,
      reason: "soul-link",
      triggeredByPokemonId: pokemon.id,
    };
  }
}

function recordEventHistory<TGameState>(
  state: MutableRunState<TGameState | undefined>,
  event: RunEvent,
): void {
  const references = getEventReferences(event);
  const touchedLinkIds = new Set<SoulLinkId>(references.soulLinkIds);

  for (const pokemonId of references.pokemonIds) {
    const pokemon = state.pokemon.get(pokemonId);
    if (pokemon === undefined) continue;
    addUnique(pokemon.historyEventIds, event.id);
    if (pokemon.soulLinkId !== undefined) touchedLinkIds.add(pokemon.soulLinkId);
  }

  for (const linkId of touchedLinkIds) {
    const link = state.soulLinks.get(linkId);
    if (link !== undefined) addUnique(link.historyEventIds, event.id);
  }

  if (event.type === "pokemon-death") {
    const pokemon = state.pokemon.get(event.pokemonId);
    if (pokemon?.soulLinkId !== undefined) {
      const link = state.soulLinks.get(pokemon.soulLinkId);
      if (link !== undefined) {
        const partner = state.pokemon.get(otherPokemonId(link.pokemonIds, pokemon.id));
        if (partner !== undefined) addUnique(partner.historyEventIds, event.id);
      }
    }
  }

  if (event.type === "party-changed" && event.to === "retired") {
    for (const pokemonId of event.pokemonIds) {
      const pokemon = state.pokemon.get(pokemonId);
      if (pokemon?.soulLinkId === undefined) continue;
      const link = state.soulLinks.get(pokemon.soulLinkId);
      if (link === undefined) continue;
      const partner = state.pokemon.get(otherPokemonId(link.pokemonIds, pokemon.id));
      if (partner !== undefined && partner.retirement?.eventId === event.id) {
        addUnique(partner.historyEventIds, event.id);
      }
    }
  }
}

function otherPokemonId(
  pokemonIds: readonly [PokemonId, PokemonId],
  pokemonId: PokemonId,
): PokemonId {
  return pokemonIds[0] === pokemonId ? pokemonIds[1] : pokemonIds[0];
}

function addUnique(values: EventId[], value: EventId): void {
  if (!values.includes(value)) values.push(value);
}
