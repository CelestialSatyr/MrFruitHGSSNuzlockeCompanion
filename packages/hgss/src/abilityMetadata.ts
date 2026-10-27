import type { PokemonType } from "@nuzlocke/core";
import type { HgssMovePlannerData } from "./moveMetadata.ts";
import { normaliseMoveId } from "./moveMetadata.ts";

export type AbilityEffectTone = "positive" | "neutral" | "negative";

export interface HgssAbilityFit {
  tone: AbilityEffectTone;
  /** Planner score only. Negative abilities intentionally outweigh one good nature. */
  score: number;
  reason: string;
}

function normaliseAbilityId(value: string): string {
  return value.trim().toLowerCase().replaceAll("_", "-").replaceAll(" ", "-");
}

/**
 * Ability tone is the ability's inherent effect. Contextual planner/overview
 * evaluation is layered on top by `getHgssAbilityFit` below.
 */
const POSITIVE_HGSS_ABILITIES = new Set([
  "stench",
  "drizzle",
  "speed-boost",
  "battle-armor",
  "sturdy",
  "damp",
  "limber",
  "sand-veil",
  "static",
  "volt-absorb",
  "water-absorb",
  "oblivious",
  "compound-eyes",
  "insomnia",
  "immunity",
  "flash-fire",
  "shield-dust",
  "own-tempo",
  "suction-cups",
  "intimidate",
  "shadow-tag",
  "rough-skin",
  "wonder-guard",
  "levitate",
  "effect-spore",
  "synchronize",
  "clear-body",
  "natural-cure",
  "serene-grace",
  "swift-swim",
  "chlorophyll",
  "trace",
  "huge-power",
  "poison-point",
  "inner-focus",
  "magma-armor",
  "water-veil",
  "magnet-pull",
  "soundproof",
  "rain-dish",
  "sand-stream",
  "pressure",
  "thick-fat",
  "early-bird",
  "flame-body",
  "run-away",
  "keen-eye",
  "hyper-cutter",
  "pickup",
  "cute-charm",
  "plus",
  "minus",
  "sticky-hold",
  "shed-skin",
  "guts",
  "marvel-scale",
  "liquid-ooze",
  "overgrow",
  "blaze",
  "torrent",
  "swarm",
  "rock-head",
  "drought",
  "arena-trap",
  "vital-spirit",
  "white-smoke",
  "pure-power",
  "shell-armor",
  "tangled-feet",
  "motor-drive",
  "steadfast",
  "snow-cloak",
  "gluttony",
  "anger-point",
  "unburden",
  "heatproof",
  "download",
  "iron-fist",
  "poison-heal",
  "adaptability",
  "skill-link",
  "hydration",
  "quick-feet",
  "sniper",
  "magic-guard",
  "technician",
  "leaf-guard",
  "mold-breaker",
  "super-luck",
  "aftermath",
  "anticipation",
  "forewarn",
  "unaware",
  "tinted-lens",
  "filter",
  "scrappy",
  "ice-body",
  "solid-rock",
  "snow-warning",
  "honey-gather",
  "frisk",
  "reckless",
  "flower-gift",
  "bad-dreams",
]);

const NEUTRAL_HGSS_ABILITIES = new Set([
  "cloud-nine",
  "air-lock",
  "color-change",
  "forecast",
  "multitype",
  "lightning-rod",
  "storm-drain",
  "hustle",
  "rivalry",
  "simple",
  "dry-skin",
  "solar-power",
  "normalize",
  "no-guard",
  "illuminate",
]);

const NEGATIVE_HGSS_ABILITIES = new Set(["truant", "stall", "klutz", "slow-start"]);

const PUNCHING_MOVES = new Set([
  "bullet-punch",
  "comet-punch",
  "dizzy-punch",
  "drain-punch",
  "dynamic-punch",
  "fire-punch",
  "focus-punch",
  "ice-punch",
  "mach-punch",
  "mega-punch",
  "shadow-punch",
  "sky-uppercut",
  "thunder-punch",
]);

function damaging(moves: readonly HgssMovePlannerData[]): HgssMovePlannerData[] {
  return moves.filter((move) => move.damageClass !== "status");
}

function neutralBecause(reason: string): HgssAbilityFit {
  return { tone: "neutral", score: 0, reason };
}

export function getHgssAbilityEffectTone(abilityId: string): AbilityEffectTone {
  const id = normaliseAbilityId(abilityId);
  if (NEGATIVE_HGSS_ABILITIES.has(id)) return "negative";
  if (POSITIVE_HGSS_ABILITIES.has(id)) return "positive";
  if (NEUTRAL_HGSS_ABILITIES.has(id)) return "neutral";
  return "neutral";
}

/**
 * Contextual fit for the Pokémon that actually has this ability. We only
 * downgrade a positive ability when the current recorded moveset clearly
 * cannot use its benefit. Ambiguous effects remain neutral instead of being
 * overconfidently labelled good or bad.
 */
export function getHgssAbilityFit(
  abilityId: string | undefined,
  context: {
    knownMoveIds?: readonly string[];
    moves?: readonly HgssMovePlannerData[];
    currentTypes?: readonly PokemonType[];
  } = {},
): HgssAbilityFit {
  if (!abilityId) return { tone: "neutral", score: 0, reason: "No ability is recorded." };

  const id = normaliseAbilityId(abilityId);
  const inherent = getHgssAbilityEffectTone(id);
  if (inherent === "negative") {
    return {
      tone: "negative",
      score: -4,
      reason: `${formatAbilityName(id)} is inherently detrimental in battle.`,
    };
  }
  if (inherent === "neutral") {
    return {
      tone: "neutral",
      score: 0,
      reason: `${formatAbilityName(id)} is matchup-dependent or has a meaningful trade-off.`,
    };
  }

  const moveIds = (context.knownMoveIds ?? []).map(normaliseMoveId);
  const moves = context.moves ?? [];
  const damagingMoves = damaging(moves);
  const hasMove = (predicate: (move: HgssMovePlannerData) => boolean) => moves.some(predicate);

  switch (id) {
    case "iron-fist": {
      const hasPunch = moveIds.some((moveId) => PUNCHING_MOVES.has(moveId));
      if (!hasPunch) {
        return neutralBecause(
          "Iron Fist is neutral here because no recorded current move is a punching move.",
        );
      }
      break;
    }
    case "rock-head":
    case "reckless": {
      if (!hasMove((move) => (move.drain ?? 0) < 0)) {
        return neutralBecause(
          `${formatAbilityName(id)} is neutral here because no recorded current move has recoil.`,
        );
      }
      break;
    }
    case "skill-link": {
      if (!hasMove((move) => (move.maxHits ?? 1) > 1)) {
        return neutralBecause(
          "Skill Link is neutral here because no recorded current move is multi-hit.",
        );
      }
      break;
    }
    case "technician": {
      if (!hasMove((move) => move.damageClass !== "status" && (move.power ?? 999) <= 60)) {
        return neutralBecause(
          "Technician is neutral here because no recorded damaging move has 60 or less base power.",
        );
      }
      break;
    }
    case "guts":
    case "huge-power":
    case "pure-power": {
      if (!hasMove((move) => move.damageClass === "physical")) {
        return neutralBecause(
          `${formatAbilityName(id)} is neutral here because no recorded current move uses Attack.`,
        );
      }
      break;
    }
    case "solar-power": {
      if (!hasMove((move) => move.damageClass === "special")) {
        return neutralBecause(
          "Solar Power is neutral here because no recorded current move uses Sp. Atk.",
        );
      }
      break;
    }
    case "adaptability": {
      const types = new Set(context.currentTypes ?? []);
      if (!damagingMoves.some((move) => move.type !== undefined && types.has(move.type))) {
        return neutralBecause(
          "Adaptability is neutral here because no recorded damaging move currently receives STAB.",
        );
      }
      break;
    }
    case "blaze":
    case "overgrow":
    case "torrent":
    case "swarm": {
      const requiredType: PokemonType =
        id === "blaze" ? "fire" : id === "overgrow" ? "grass" : id === "torrent" ? "water" : "bug";
      if (!damagingMoves.some((move) => move.type === requiredType)) {
        return neutralBecause(
          `${formatAbilityName(id)} is neutral here because no recorded damaging move is ${requiredType}-type.`,
        );
      }
      break;
    }
    case "sniper":
    case "download": {
      if (!damagingMoves.length && moveIds.length > 0) {
        return neutralBecause(
          `${formatAbilityName(id)} is neutral here because the recorded moveset has no damaging move.`,
        );
      }
      break;
    }
  }

  return {
    tone: "positive",
    score: 2,
    reason: `${formatAbilityName(id)} provides a useful battle benefit for the current recorded setup.`,
  };
}

export function formatAbilityName(abilityId: string): string {
  return normaliseAbilityId(abilityId)
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
