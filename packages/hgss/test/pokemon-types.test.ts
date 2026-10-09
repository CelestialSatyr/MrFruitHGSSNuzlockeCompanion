import { describe, expect, it } from "vitest";
import {
  resolveHgssPokemonBaseStatTotal,
  resolveHgssPokemonTypes,
  resolvePokemonBaseStatTotal,
} from "../src/pokemonTypes";

describe("resolveHgssPokemonTypes", () => {
  it("uses a pre-Fairy historical type set for HGSS", () => {
    expect(
      resolveHgssPokemonTypes({
        types: [{ slot: 1, type: { name: "fairy" } }],
        past_types: [
          {
            generation: { name: "generation-v" },
            types: [{ slot: 1, type: { name: "normal" } }],
          },
        ],
      }),
    ).toEqual(["normal"]);
  });

  it("ignores a generation-I type set when resolving generation IV", () => {
    expect(
      resolveHgssPokemonTypes({
        types: [
          { slot: 1, type: { name: "electric" } },
          { slot: 2, type: { name: "steel" } },
        ],
        past_types: [
          {
            generation: { name: "generation-i" },
            types: [{ slot: 1, type: { name: "electric" } }],
          },
        ],
      }),
    ).toEqual(["electric", "steel"]);
  });

  it("uses the HGSS-era total for species that were buffed later", () => {
    expect(
      resolveHgssPokemonBaseStatTotal(25, {
        types: [{ slot: 1, type: { name: "electric" } }],
        stats: [
          { base_stat: 35, stat: { name: "hp" } },
          { base_stat: 55, stat: { name: "attack" } },
          { base_stat: 40, stat: { name: "defense" } },
          { base_stat: 50, stat: { name: "special-attack" } },
          { base_stat: 50, stat: { name: "special-defense" } },
          { base_stat: 90, stat: { name: "speed" } },
        ],
      }),
    ).toBe(300);
  });
});

describe("resolvePokemonBaseStatTotal", () => {
  it("adds the six base stats", () => {
    expect(
      resolvePokemonBaseStatTotal({
        types: [{ slot: 1, type: { name: "fire" } }],
        stats: [
          { base_stat: 78, stat: { name: "hp" } },
          { base_stat: 84, stat: { name: "attack" } },
          { base_stat: 78, stat: { name: "defense" } },
          { base_stat: 109, stat: { name: "special-attack" } },
          { base_stat: 85, stat: { name: "special-defense" } },
          { base_stat: 100, stat: { name: "speed" } },
        ],
      }),
    ).toBe(534);
  });
});
