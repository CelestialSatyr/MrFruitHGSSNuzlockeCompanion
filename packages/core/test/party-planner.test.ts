import { describe, expect, it } from "vitest";
import {
  analyseManualParty,
  findPartyRecommendations,
  getPairAvailability,
  type PartyPlannerPair,
  type PartyPlannerPokemon,
} from "../src/partyPlanner";
import type { PokemonType } from "../src/pokemonTypes";

function mon(
  id: string,
  playerId: string,
  primaryType: PokemonType,
  actualTypes: PokemonType[],
): PartyPlannerPokemon {
  return {
    id,
    playerId,
    speciesId: Number(id.replace(/\D/g, "")) || 1,
    speciesName: id,
    primaryType,
    actualTypes,
    flyingTypeDeclared: primaryType === "flying",
  };
}

function pair(
  id: string,
  leftPrimary: PokemonType,
  rightPrimary: PokemonType,
  leftTypes: PokemonType[] = [leftPrimary],
  rightTypes: PokemonType[] = [rightPrimary],
): PartyPlannerPair {
  return {
    id,
    left: mon(`${id}-left`, "fruit", leftPrimary, leftTypes),
    right: mon(`${id}-right`, "blue", rightPrimary, rightTypes),
  };
}

describe("Party Planner", () => {
  it("enforces primary uniqueness globally across both players", () => {
    const candidates = [
      pair("a", "water", "fire"),
      pair("b", "grass", "water"),
      pair("c", "electric", "psychic"),
    ];

    const [best] = findPartyRecommendations(candidates, { random: () => 0.5 });
    expect(best?.score.pairCount).toBe(2);
    expect(best?.pairIds).toContain("c");
    expect(best?.pairIds.includes("a") && best?.pairIds.includes("b")).toBe(false);
  });

  it("prefers more pairs before type diversity", () => {
    const candidates = [
      pair("a", "water", "fire", ["water", "flying"], ["fire", "flying"]),
      pair("b", "grass", "electric", ["grass", "flying"], ["electric", "flying"]),
      pair("c", "psychic", "rock", ["psychic"], ["rock"]),
    ];

    const [best] = findPartyRecommendations(candidates, { maxPairs: 3, random: () => 0.5 });
    expect(best?.score.pairCount).toBe(3);
  });

  it("uses unique actual typings as the first tie breaker", () => {
    const candidates = [
      pair("a", "water", "fire", ["water", "ice"], ["fire", "flying"]),
      pair("b", "grass", "electric", ["grass", "poison"], ["electric", "steel"]),
      pair("c", "water", "fire", ["water"], ["fire"]),
      pair("d", "grass", "electric", ["grass"], ["electric"]),
    ];

    const [best] = findPartyRecommendations(candidates, { maxPairs: 2, random: () => 0.5 });
    expect(best?.pairIds.sort()).toEqual(["a", "b"]);
    expect(best?.score.uniqueTypeCount).toBe(8);
  });

  it("minimises overlap after unique type count", () => {
    const candidates = [
      pair("a", "water", "fire", ["water", "flying"], ["fire", "flying"]),
      pair("b", "grass", "electric", ["grass"], ["electric"]),
      pair("c", "water", "fire", ["water"], ["fire"]),
      pair("d", "grass", "electric", ["grass", "flying"], ["electric"]),
    ];

    const [best] = findPartyRecommendations(candidates, { maxPairs: 2, random: () => 0.5 });
    expect(best?.score.uniqueTypeCount).toBe(5);
    expect(best?.score.overlapCount).toBe(0);
  });

  it("disables manual choices that conflict with either side of selected links", () => {
    const selected = pair("selected", "water", "psychic");
    const waterConflict = pair("water-conflict", "grass", "water");
    const psychicConflict = pair("psychic-conflict", "psychic", "fire");
    const valid = pair("valid", "ground", "electric");

    expect(getPairAvailability(waterConflict, [selected]).state).toBe("disabled");
    expect(getPairAvailability(psychicConflict, [selected]).state).toBe("disabled");
    expect(getPairAvailability(valid, [selected]).state).toBe("available");
  });

  it("reports manual diversity and overlap", () => {
    const analysis = analyseManualParty([
      pair("a", "water", "fire", ["water", "flying"], ["fire"]),
      pair("b", "grass", "electric", ["grass", "flying"], ["electric"]),
    ]);

    expect(analysis.score.pairCount).toBe(2);
    expect(analysis.score.uniqueTypeCount).toBe(5);
    expect(analysis.score.overlapCount).toBe(1);
  });
});
