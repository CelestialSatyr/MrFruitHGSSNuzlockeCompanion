import { describe, expect, it } from "vitest";
import {
  analyseManualParty,
  findPartyRecommendations,
  getPairAvailability,
  type PartyPlannerPair,
  type PartyPlannerPokemon,
} from "../partyPlanner";
import type { PokemonType } from "../pokemonTypes";

function mon(
  id: string,
  playerId: string,
  primaryType: PokemonType,
  actualTypes: PokemonType[],
  baseStatTotal = 400,
): PartyPlannerPokemon {
  return {
    id,
    playerId,
    speciesId: Number(id.replace(/\D/g, "")) || 1,
    speciesName: id,
    primaryType,
    actualTypes,
    baseStatTotal,
    flyingTypeDeclared: primaryType === "flying",
  };
}

function pair(
  id: string,
  leftPrimary: PokemonType,
  rightPrimary: PokemonType,
  leftTypes: PokemonType[] = [leftPrimary],
  rightTypes: PokemonType[] = [rightPrimary],
  leftBst = 400,
  rightBst = 400,
): PartyPlannerPair {
  return {
    id,
    left: mon(`${id}-left`, "fruit", leftPrimary, leftTypes, leftBst),
    right: mon(`${id}-right`, "blue", rightPrimary, rightTypes, rightBst),
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

  it("prefers more pairs before type diversity with the default ranking", () => {
    const candidates = [
      pair("a", "water", "fire", ["water", "flying"], ["fire", "flying"]),
      pair("b", "grass", "electric", ["grass", "flying"], ["electric", "flying"]),
      pair("c", "psychic", "rock", ["psychic"], ["rock"]),
    ];

    const [best] = findPartyRecommendations(candidates, { maxPairs: 3, random: () => 0.5 });
    expect(best?.score.pairCount).toBe(3);
  });

  it("uses unique actual typings as the first default tie breaker", () => {
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

  it("minimises overlap after unique type count by default", () => {
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

  it("uses total BST after the default typing criteria tie", () => {
    const candidates = [
      pair("low", "water", "fire", ["water"], ["fire"], 400, 400),
      pair("high", "water", "fire", ["water"], ["fire"], 530, 500),
    ];

    const [best] = findPartyRecommendations(candidates, { maxPairs: 1, random: () => 0.5 });
    expect(best?.pairIds).toEqual(["high"]);
    expect(best?.score.totalBaseStats).toBe(1030);
  });

  it("allows total BST to outrank pair count when the priorities are rearranged", () => {
    const candidates = [
      pair("elite", "water", "fire", ["water"], ["fire"], 650, 650),
      pair("weak-a", "water", "grass", ["water"], ["grass"], 300, 300),
      pair("weak-b", "fire", "electric", ["fire"], ["electric"], 300, 300),
    ];

    const [best] = findPartyRecommendations(candidates, {
      maxPairs: 2,
      random: () => 0.5,
      ranking: ["totalBaseStats", "pairCount"],
    });

    // The elite link conflicts with both weaker links. The alternative legal team
    // has two pairs (1200 BST), but BST-first deliberately picks one elite pair (1300).
    expect(best?.pairIds).toEqual(["elite"]);
    expect(best?.score.pairCount).toBe(1);
    expect(best?.score.totalBaseStats).toBe(1300);
  });

  it("can completely disable pair count as a ranking criterion", () => {
    const candidates = [
      pair("diverse", "water", "fire", ["water", "ice"], ["fire", "flying"], 300, 300),
      pair("plain-a", "water", "grass", ["normal"], ["normal"], 500, 500),
      pair("plain-b", "fire", "electric", ["normal"], ["normal"], 500, 500),
    ];

    const [best] = findPartyRecommendations(candidates, {
      maxPairs: 2,
      random: () => 0.5,
      ranking: ["uniqueTypeCount"],
    });

    expect(best?.pairIds).toEqual(["diverse"]);
    expect(best?.score.pairCount).toBe(1);
    expect(best?.score.uniqueTypeCount).toBe(4);
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

  it("reports manual diversity, overlap and total BST", () => {
    const analysis = analyseManualParty([
      pair("a", "water", "fire", ["water", "flying"], ["fire"], 500, 450),
      pair("b", "grass", "electric", ["grass", "flying"], ["electric"], 425, 475),
    ]);

    expect(analysis.score.pairCount).toBe(2);
    expect(analysis.score.uniqueTypeCount).toBe(5);
    expect(analysis.score.overlapCount).toBe(1);
    expect(analysis.score.totalBaseStats).toBe(1850);
  });
});
