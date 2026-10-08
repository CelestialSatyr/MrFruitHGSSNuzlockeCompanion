import { POKEMON_TYPES, type PokemonType } from "./pokemonTypes.ts";

export interface PartyPlannerPokemon {
  id: string;
  playerId: string;
  speciesId: number;
  nickname?: string;
  speciesName: string;
  /** The effective primary used by the Soul Link primary-typing rule. */
  primaryType: PokemonType;
  /** Current in-game typings. Used only for diversity scoring. */
  actualTypes: readonly PokemonType[];
  /** Historical capture decision; useful for UI badges. */
  flyingTypeDeclared: boolean;
  shiny?: boolean;
}

export interface PartyPlannerPair {
  id: string;
  left: PartyPlannerPokemon;
  right: PartyPlannerPokemon;
}

export interface PartyPlannerScore {
  pairCount: number;
  uniqueTypeCount: number;
  overlapCount: number;
  typeOccurrences: number;
}

export interface PartyPlannerRecommendation {
  pairIds: string[];
  pairs: PartyPlannerPair[];
  score: PartyPlannerScore;
}

export interface PairAvailability {
  state: "selected" | "available" | "disabled";
  reason?: string;
  conflictingTypes: PokemonType[];
}

export interface ManualPartyAnalysis {
  selectedPairs: PartyPlannerPair[];
  usedPrimaryTypes: PokemonType[];
  actualTypes: PokemonType[];
  score: PartyPlannerScore;
}

interface PlannerState {
  primaryMask: number;
  actualMask: number;
  typeOccurrences: number;
  pairIds: string[];
}

const TYPE_INDEX = new Map<PokemonType, number>(POKEMON_TYPES.map((type, index) => [type, index]));

function bitFor(type: PokemonType): number {
  const index = TYPE_INDEX.get(type);
  if (index === undefined) throw new Error(`Unsupported Pokémon type: ${type}`);
  return 1 << index;
}

function popcount(value: number): number {
  let count = 0;
  let remaining = value >>> 0;
  while (remaining) {
    remaining &= remaining - 1;
    count += 1;
  }
  return count;
}

function primaryMaskFor(pair: PartyPlannerPair): number {
  return bitFor(pair.left.primaryType) | bitFor(pair.right.primaryType);
}

function actualMaskFor(pair: PartyPlannerPair): number {
  return [...pair.left.actualTypes, ...pair.right.actualTypes].reduce(
    (mask, type) => mask | bitFor(type),
    0,
  );
}

function actualOccurrenceCount(pair: PartyPlannerPair): number {
  return pair.left.actualTypes.length + pair.right.actualTypes.length;
}

function scoreState(state: PlannerState): PartyPlannerScore {
  const uniqueTypeCount = popcount(state.actualMask);
  return {
    pairCount: state.pairIds.length,
    uniqueTypeCount,
    overlapCount: state.typeOccurrences - uniqueTypeCount,
    typeOccurrences: state.typeOccurrences,
  };
}

export function comparePartyPlannerScores(a: PartyPlannerScore, b: PartyPlannerScore): number {
  if (a.pairCount !== b.pairCount) return b.pairCount - a.pairCount;
  if (a.uniqueTypeCount !== b.uniqueTypeCount) return b.uniqueTypeCount - a.uniqueTypeCount;
  if (a.overlapCount !== b.overlapCount) return a.overlapCount - b.overlapCount;
  return 0;
}

function exactStateKey(state: PlannerState): string {
  return `${state.primaryMask}:${state.actualMask}:${state.typeOccurrences}:${state.pairIds.length}`;
}

function teamKey(pairIds: readonly string[]): string {
  return [...pairIds].sort().join("|");
}

/**
 * Keep up to `limit` distinct representatives for states that are mathematically
 * equivalent for all future planner decisions. Reservoir replacement gives tied
 * teams a chance to rotate between runs without changing the ranking rules.
 */
function mergeEquivalentState(
  states: Map<string, PlannerState[]>,
  incoming: PlannerState,
  limit: number,
  random: () => number,
): void {
  const key = exactStateKey(incoming);
  const bucket = states.get(key) ?? [];
  const incomingTeamKey = teamKey(incoming.pairIds);
  if (bucket.some((entry) => teamKey(entry.pairIds) === incomingTeamKey)) return;

  if (bucket.length < limit) {
    bucket.push(incoming);
  } else {
    const index = Math.floor(random() * (bucket.length + 1));
    if (index < limit) bucket[index] = incoming;
  }
  states.set(key, bucket);
}

function validateCandidate(pair: PartyPlannerPair): string | undefined {
  if (pair.left.primaryType === pair.right.primaryType) {
    return `Soul Link ${pair.id} repeats ${pair.left.primaryType} inside the pair.`;
  }
  if (!pair.left.actualTypes.length || !pair.right.actualTypes.length) {
    return `Soul Link ${pair.id} is missing current typing data.`;
  }
  return undefined;
}

/**
 * Exact optimiser for the Party Planner.
 *
 * Ranking is, in order:
 * 1. most Soul Link pairs (up to maxPairs)
 * 2. most unique current typings across all Pokémon
 * 3. least total typing overlap
 * 4. arbitrary/random ordering for mathematically tied teams
 *
 * The sparse DP is exact. States can be merged when they have the same used
 * primary types, current-type union, occurrence count and pair count because
 * those values fully determine both future feasibility and final score.
 */
export function findPartyRecommendations(
  candidates: readonly PartyPlannerPair[],
  options: {
    maxPairs?: number;
    resultCount?: number;
    random?: () => number;
  } = {},
): PartyPlannerRecommendation[] {
  const maxPairs = options.maxPairs ?? 6;
  const resultCount = options.resultCount ?? 3;
  const random = options.random ?? Math.random;

  if (maxPairs < 1 || resultCount < 1) return [];

  const validCandidates = candidates.filter((pair) => validateCandidate(pair) === undefined);
  const pairById = new Map(validCandidates.map((pair) => [pair.id, pair]));

  const states = new Map<string, PlannerState[]>();
  const empty: PlannerState = {
    primaryMask: 0,
    actualMask: 0,
    typeOccurrences: 0,
    pairIds: [],
  };
  states.set(exactStateKey(empty), [empty]);

  for (const pair of validCandidates) {
    const pairPrimaryMask = primaryMaskFor(pair);
    const pairActualMask = actualMaskFor(pair);
    const pairOccurrences = actualOccurrenceCount(pair);
    const snapshot = [...states.values()].flatMap((bucket) => [...bucket]);

    for (const state of snapshot) {
      if (state.pairIds.length >= maxPairs) continue;
      if ((state.primaryMask & pairPrimaryMask) !== 0) continue;

      mergeEquivalentState(
        states,
        {
          primaryMask: state.primaryMask | pairPrimaryMask,
          actualMask: state.actualMask | pairActualMask,
          typeOccurrences: state.typeOccurrences + pairOccurrences,
          pairIds: [...state.pairIds, pair.id],
        },
        resultCount,
        random,
      );
    }
  }

  const recommendations: Array<PartyPlannerRecommendation & { tieBreaker: number }> = [];
  const seenTeams = new Set<string>();

  for (const bucket of states.values()) {
    for (const state of bucket) {
      if (!state.pairIds.length) continue;
      const key = teamKey(state.pairIds);
      if (seenTeams.has(key)) continue;
      seenTeams.add(key);
      const pairs = state.pairIds
        .map((id) => pairById.get(id))
        .filter((pair): pair is PartyPlannerPair => pair !== undefined);
      recommendations.push({
        pairIds: [...state.pairIds],
        pairs,
        score: scoreState(state),
        tieBreaker: random(),
      });
    }
  }

  recommendations.sort((a, b) => {
    const score = comparePartyPlannerScores(a.score, b.score);
    return score !== 0 ? score : a.tieBreaker - b.tieBreaker;
  });

  return recommendations
    .slice(0, resultCount)
    .map(({ tieBreaker: _tieBreaker, ...entry }) => entry);
}

export function analyseManualParty(
  selectedPairs: readonly PartyPlannerPair[],
): ManualPartyAnalysis {
  let actualMask = 0;
  let typeOccurrences = 0;
  const primaryTypes = new Set<PokemonType>();

  for (const pair of selectedPairs) {
    primaryTypes.add(pair.left.primaryType);
    primaryTypes.add(pair.right.primaryType);
    actualMask |= actualMaskFor(pair);
    typeOccurrences += actualOccurrenceCount(pair);
  }

  const actualTypes = POKEMON_TYPES.filter((type) => (actualMask & bitFor(type)) !== 0);
  return {
    selectedPairs: [...selectedPairs],
    usedPrimaryTypes: POKEMON_TYPES.filter((type) => primaryTypes.has(type)),
    actualTypes,
    score: {
      pairCount: selectedPairs.length,
      uniqueTypeCount: actualTypes.length,
      overlapCount: typeOccurrences - actualTypes.length,
      typeOccurrences,
    },
  };
}

export function getPairAvailability(
  candidate: PartyPlannerPair,
  selectedPairs: readonly PartyPlannerPair[],
  maxPairs = 6,
): PairAvailability {
  if (selectedPairs.some((pair) => pair.id === candidate.id)) {
    return { state: "selected", conflictingTypes: [] };
  }

  if (selectedPairs.length >= maxPairs) {
    return {
      state: "disabled",
      reason: `Party already contains ${maxPairs} Soul Link pairs.`,
      conflictingTypes: [],
    };
  }

  const usedByType = new Map<PokemonType, PartyPlannerPokemon>();
  for (const pair of selectedPairs) {
    usedByType.set(pair.left.primaryType, pair.left);
    usedByType.set(pair.right.primaryType, pair.right);
  }

  const conflictingTypes = [candidate.left.primaryType, candidate.right.primaryType].filter(
    (type, index, all) => usedByType.has(type) && all.indexOf(type) === index,
  );

  if (!conflictingTypes.length) {
    return { state: "available", conflictingTypes: [] };
  }

  const descriptions = conflictingTypes.map((type) => {
    const owner = usedByType.get(type)!;
    return `${type} is already used by ${owner.nickname ?? owner.speciesName}`;
  });

  return {
    state: "disabled",
    reason: descriptions.join("; "),
    conflictingTypes,
  };
}

export function isValidManualParty(
  selectedPairs: readonly PartyPlannerPair[],
  maxPairs = 6,
): boolean {
  if (selectedPairs.length > maxPairs) return false;
  const used = new Set<PokemonType>();
  for (const pair of selectedPairs) {
    for (const type of [pair.left.primaryType, pair.right.primaryType]) {
      if (used.has(type)) return false;
      used.add(type);
    }
  }
  return true;
}
