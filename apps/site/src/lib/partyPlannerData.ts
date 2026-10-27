import type {
  PartyPlannerPair,
  PartyPlannerPokemon,
  PokemonState,
  PokemonType,
  RunDataset,
  RunState,
} from "@nuzlocke/core";
import {
  getHgssAbilityFit,
  getHgssNatureFit,
  type HgssMovePlannerData,
  type HgssPokemonPlannerData,
  type HgssProgressionState,
} from "@nuzlocke/hgss";
import { getSpeciesName } from "./pokemon";

export interface PartyPlannerDataResult {
  pairs: PartyPlannerPair[];
  unresolvedFlyingPokemonIds: string[];
  invalidPairIds: string[];
}

export interface ResolvedPokemonRuleTyping {
  capturedPrimaryType: PokemonType;
  currentTypes: readonly PokemonType[];
  primaryType: PokemonType;
  flyingTypeDeclared: boolean;
  requiresFlyingDeclaration: boolean;
}

interface CaptureRuleData {
  captureTypes: readonly PokemonType[];
  flyingTypeDeclared: boolean | undefined;
}

function captureRuleForPokemon(
  dataset: RunDataset,
  pokemon: PokemonState,
  typesBySpecies: ReadonlyMap<number, readonly PokemonType[]>,
): CaptureRuleData | undefined {
  const event = dataset.events.find((entry) => entry.id === pokemon.createdByEventId);
  if (!event || event.type !== "encounter") return undefined;
  const outcome = event.outcomes.find(
    (entry) => entry.result === "caught" && entry.pokemonId === pokemon.id,
  );
  if (!outcome || outcome.result !== "caught") return undefined;

  const captureTypes = typesBySpecies.get(outcome.speciesId);
  if (!captureTypes?.length) return undefined;
  return {
    captureTypes,
    flyingTypeDeclared: outcome.flyingTypeDeclared,
  };
}

export function resolvePokemonRuleTyping(
  dataset: RunDataset,
  pokemon: PokemonState,
  typesBySpecies: ReadonlyMap<number, readonly PokemonType[]>,
): ResolvedPokemonRuleTyping | undefined {
  const capture = captureRuleForPokemon(dataset, pokemon, typesBySpecies);
  const currentTypes = typesBySpecies.get(pokemon.currentSpeciesId);
  if (!capture || !currentTypes?.length) return undefined;
  const capturedPrimaryType = capture.captureTypes[0];
  if (!capturedPrimaryType) return undefined;
  // The run's Flying Clause applies only when Flying was the secondary typing at capture.
  const eligibleForFlyingClause = capture.captureTypes[1] === "flying";
  const requiresFlyingDeclaration =
    eligibleForFlyingClause && capture.flyingTypeDeclared === undefined;
  const flyingTypeDeclared = eligibleForFlyingClause && capture.flyingTypeDeclared === true;
  const primaryType =
    flyingTypeDeclared && currentTypes.includes("flying") ? "flying" : capturedPrimaryType;
  return {
    capturedPrimaryType,
    currentTypes,
    primaryType,
    flyingTypeDeclared,
    requiresFlyingDeclaration,
  };
}

function makePlannerPokemon(
  dataset: RunDataset,
  pokemon: PokemonState,
  dataBySpecies: ReadonlyMap<number, HgssPokemonPlannerData>,
  moveDataById: ReadonlyMap<string, HgssMovePlannerData>,
  typesBySpecies: ReadonlyMap<number, readonly PokemonType[]>,
  unresolvedFlyingPokemonIds: string[],
): PartyPlannerPokemon | undefined {
  const resolved = resolvePokemonRuleTyping(dataset, pokemon, typesBySpecies);
  const currentData = dataBySpecies.get(pokemon.currentSpeciesId);
  if (!resolved || !currentData) return undefined;
  if (resolved.requiresFlyingDeclaration) {
    unresolvedFlyingPokemonIds.push(pokemon.id);
    return undefined;
  }
  const { currentTypes, primaryType, flyingTypeDeclared } = resolved;
  const moves = pokemon.knownMoveIds
    .map((moveId) =>
      moveDataById.get(moveId.trim().toLowerCase().replaceAll("_", "-").replaceAll(" ", "-")),
    )
    .filter((move): move is HgssMovePlannerData => move !== undefined);
  const abilityFit = getHgssAbilityFit(pokemon.abilityId, {
    knownMoveIds: pokemon.knownMoveIds,
    moves,
    currentTypes,
  });
  const natureFit = getHgssNatureFit(pokemon.natureId, { baseStats: currentData.baseStats, moves });

  return {
    id: pokemon.id,
    playerId: pokemon.playerId,
    speciesId: pokemon.currentSpeciesId,
    ...(pokemon.currentNickname ? { nickname: pokemon.currentNickname } : {}),
    speciesName: getSpeciesName(pokemon.currentSpeciesId),
    primaryType,
    actualTypes: currentTypes,
    baseStatTotal: currentData.baseStatTotal,
    ...(pokemon.abilityId ? { abilityId: pokemon.abilityId } : {}),
    ...(pokemon.natureId ? { natureId: pokemon.natureId } : {}),
    abilityFit: abilityFit.tone,
    natureFit: natureFit.tone,
    abilityFitReason: abilityFit.reason,
    natureFitReason: natureFit.reason,
    flyingTypeDeclared,
    shiny: pokemon.source.shiny,
  };
}

export function buildPartyPlannerData(
  dataset: RunDataset,
  state: RunState<HgssProgressionState>,
  dataBySpecies: ReadonlyMap<number, HgssPokemonPlannerData>,
  moveDataById: ReadonlyMap<string, HgssMovePlannerData> = new Map(),
): PartyPlannerDataResult {
  const [leftPlayerId, rightPlayerId] = dataset.run.playerIds;
  const unresolvedFlyingPokemonIds: string[] = [];
  const invalidPairIds: string[] = [];
  const pairs: PartyPlannerPair[] = [];
  const typesBySpecies = new Map(
    [...dataBySpecies].map(([speciesId, data]) => [speciesId, data.types] as const),
  );

  for (const link of state.soulLinks.values()) {
    if (link.status !== "active") continue;

    const linked = link.pokemonIds
      .map((id) => state.pokemon.get(id))
      .filter((pokemon): pokemon is PokemonState => pokemon !== undefined);
    if (linked.length !== 2 || linked.some((pokemon) => pokemon.lifeStatus !== "alive")) continue;

    const leftState = linked.find((pokemon) => pokemon.playerId === leftPlayerId);
    const rightState = linked.find((pokemon) => pokemon.playerId === rightPlayerId);
    if (!leftState || !rightState) continue;

    const left = makePlannerPokemon(
      dataset,
      leftState,
      dataBySpecies,
      moveDataById,
      typesBySpecies,
      unresolvedFlyingPokemonIds,
    );
    const right = makePlannerPokemon(
      dataset,
      rightState,
      dataBySpecies,
      moveDataById,
      typesBySpecies,
      unresolvedFlyingPokemonIds,
    );
    if (!left || !right) continue;

    // This should never happen because the run rerolls invalid encounter pairs,
    // but malformed authored data must not leak into recommendations.
    if (left.primaryType === right.primaryType) {
      invalidPairIds.push(link.id);
      continue;
    }

    pairs.push({ id: link.id, left, right });
  }

  return {
    pairs,
    unresolvedFlyingPokemonIds: [...new Set(unresolvedFlyingPokemonIds)],
    invalidPairIds,
  };
}

export function collectPartyPlannerSpeciesIds(
  dataset: RunDataset,
  state: RunState<HgssProgressionState>,
): number[] {
  const ids = new Set<number>();

  for (const link of state.soulLinks.values()) {
    if (link.status !== "active") continue;
    for (const pokemonId of link.pokemonIds) {
      const pokemon = state.pokemon.get(pokemonId);
      if (!pokemon || pokemon.lifeStatus !== "alive") continue;
      ids.add(pokemon.currentSpeciesId);

      const event = dataset.events.find((entry) => entry.id === pokemon.createdByEventId);
      if (event?.type !== "encounter") continue;
      const outcome = event.outcomes.find(
        (entry) => entry.result === "caught" && entry.pokemonId === pokemon.id,
      );
      if (outcome?.result === "caught") ids.add(outcome.speciesId);
    }
  }

  return [...ids];
}

export function collectPartyPlannerMoveIds(state: RunState<HgssProgressionState>): string[] {
  const ids = new Set<string>();
  for (const link of state.soulLinks.values()) {
    if (link.status !== "active") continue;
    for (const pokemonId of link.pokemonIds) {
      const pokemon = state.pokemon.get(pokemonId);
      if (!pokemon || pokemon.lifeStatus !== "alive") continue;
      for (const moveId of pokemon.knownMoveIds) {
        const normalised = moveId.trim().toLowerCase().replaceAll("_", "-").replaceAll(" ", "-");
        if (normalised) ids.add(normalised);
      }
    }
  }
  return [...ids];
}
