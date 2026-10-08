import { describe, expect, it } from "vitest";
import { resolveHgssPokemonTypes } from "../src/pokemonTypes";

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
});
