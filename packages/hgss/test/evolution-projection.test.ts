import { describe, expect, it } from "vitest";
import {
  createInitialHgssProgressionState,
  getHgssPlannerLevelCap,
  resolveHgssEvolutionProjectionFromChain,
} from "../src/index";

function detail(trigger: string, minLevel: number | null = null) {
  return {
    trigger: { name: trigger },
    min_level: minLevel,
    gender: null,
    held_item: null,
    item: null,
    known_move: null,
    known_move_type: null,
    location: null,
    min_happiness: null,
    min_beauty: null,
    min_affection: null,
    needs_overworld_rain: false,
    party_species: null,
    party_type: null,
    relative_physical_stats: null,
    time_of_day: "",
    trade_species: null,
    turn_upside_down: false,
  };
}

function species(id: number) {
  return { name: `species-${id}`, url: `https://pokeapi.co/api/v2/pokemon-species/${id}/` };
}

describe("HGSS planner level caps", () => {
  it("uses the next gym ace after the latest defeated cap", () => {
    const progression = createInitialHgssProgressionState();
    expect(getHgssPlannerLevelCap(progression).level).toBe(13);
    progression.badges.zephyr = true;
    expect(getHgssPlannerLevelCap(progression).level).toBe(17);
    progression.badges.hive = true;
    progression.badges.plain = true;
    progression.badges.fog = true;
    expect(getHgssPlannerLevelCap(progression).level).toBe(31);
  });

  it("moves to the league cap after Clair", () => {
    const progression = createInitialHgssProgressionState();
    for (const badge of Object.keys(progression.badges) as (keyof typeof progression.badges)[]) {
      progression.badges[badge] = true;
    }
    expect(getHgssPlannerLevelCap(progression)).toEqual({ level: 50, label: "Pokémon League" });
  });
});

describe("HGSS evolution projection", () => {
  it("projects Pichu through Pikachu to Raichu when the linear chain is available", () => {
    const chain = {
      chain: {
        species: species(172),
        evolution_details: [],
        evolves_to: [
          {
            species: species(25),
            evolution_details: [detail("level-up")],
            evolves_to: [
              {
                species: species(26),
                evolution_details: [detail("use-item")],
                evolves_to: [],
              },
            ],
          },
        ],
      },
    };
    const projection = resolveHgssEvolutionProjectionFromChain(172, 19, chain);
    expect(projection.projectedSpeciesId).toBe(26);
    expect(projection.pathSpeciesIds).toEqual([172, 25, 26]);
  });

  it("uses the randomizer level 37 trade conversion for Haunter to Gengar", () => {
    const chain = {
      chain: {
        species: species(92),
        evolution_details: [],
        evolves_to: [
          {
            species: species(93),
            evolution_details: [detail("level-up", 25)],
            evolves_to: [
              {
                species: species(94),
                evolution_details: [detail("trade")],
                evolves_to: [],
              },
            ],
          },
        ],
      },
    };
    expect(resolveHgssEvolutionProjectionFromChain(93, 35, chain).projectedSpeciesId).toBe(93);
    expect(resolveHgssEvolutionProjectionFromChain(93, 41, chain).projectedSpeciesId).toBe(94);
  });

  it("does not guess between multiple legal evolution branches", () => {
    const chain = {
      chain: {
        species: species(133),
        evolution_details: [],
        evolves_to: [
          { species: species(134), evolution_details: [detail("use-item")], evolves_to: [] },
          { species: species(135), evolution_details: [detail("use-item")], evolves_to: [] },
        ],
      },
    };
    const projection = resolveHgssEvolutionProjectionFromChain(133, 25, chain);
    expect(projection.projectedSpeciesId).toBe(133);
    expect(projection.ambiguous).toBe(true);
  });
});
