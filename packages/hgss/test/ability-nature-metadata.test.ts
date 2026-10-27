import { describe, expect, it } from "vitest";
import {
  formatNatureStat,
  getHgssAbilityEffectTone,
  getHgssAbilityFit,
  getHgssNatureEffect,
  getHgssNatureFit,
} from "../src/index.ts";

describe("HGSS ability presentation", () => {
  it("classifies clearly beneficial abilities as positive", () => {
    expect(getHgssAbilityEffectTone("intimidate")).toBe("positive");
    expect(getHgssAbilityEffectTone("water-absorb")).toBe("positive");
  });

  it("keeps trade-off abilities neutral", () => {
    expect(getHgssAbilityEffectTone("hustle")).toBe("neutral");
    expect(getHgssAbilityEffectTone("dry-skin")).toBe("neutral");
    expect(getHgssAbilityEffectTone("no-guard")).toBe("neutral");
  });

  it("classifies inherently detrimental abilities as negative", () => {
    expect(getHgssAbilityEffectTone("truant")).toBe("negative");
    expect(getHgssAbilityEffectTone("slow-start")).toBe("negative");
  });

  it("does not guess unknown abilities", () => {
    expect(getHgssAbilityEffectTone("future-mystery-ability")).toBe("neutral");
  });
});

describe("HGSS nature presentation", () => {
  it("describes Adamant correctly", () => {
    expect(getHgssNatureEffect("adamant")).toMatchObject({
      increasedStat: "attack",
      decreasedStat: "special-attack",
    });
  });

  it("keeps neutral natures neutral", () => {
    expect(getHgssNatureEffect("hardy").increasedStat).toBeUndefined();
    expect(getHgssNatureEffect("hardy").decreasedStat).toBeUndefined();
  });

  it("formats abbreviated special stats", () => {
    expect(formatNatureStat("special-defense")).toBe("Sp. Def");
  });
});

describe("HGSS contextual trait fit", () => {
  it("downgrades Iron Fist when there is no punching move", () => {
    expect(getHgssAbilityFit("iron-fist", { knownMoveIds: ["surf", "ice-beam"] }).tone).toBe(
      "neutral",
    );
    expect(getHgssAbilityFit("iron-fist", { knownMoveIds: ["surf", "ice-punch"] }).tone).toBe(
      "positive",
    );
  });

  it("keeps Truant detrimental regardless of moves", () => {
    expect(getHgssAbilityFit("truant", { knownMoveIds: ["aerial-ace"] }).tone).toBe("negative");
  });

  it("rates an offensive nature against the species stat profile", () => {
    const physical = {
      hp: 80,
      attack: 120,
      defense: 80,
      specialAttack: 50,
      specialDefense: 80,
      speed: 90,
    };
    expect(getHgssNatureFit("adamant", { baseStats: physical }).tone).toBe("positive");
    expect(getHgssNatureFit("modest", { baseStats: physical }).tone).toBe("negative");
  });
});
