import type { HgssMovePlannerData } from "./moveMetadata.ts";
import type { HgssPokemonBaseStats } from "./pokemonTypes.ts";

export type NatureStat = "attack" | "defense" | "special-attack" | "special-defense" | "speed";
export type NatureFitTone = "positive" | "neutral" | "negative";

export interface HgssNatureEffect {
  id: string;
  name: string;
  increasedStat?: NatureStat;
  decreasedStat?: NatureStat;
}

export interface HgssNatureFit {
  tone: NatureFitTone;
  score: number;
  reason: string;
}

const NATURE_EFFECTS: Readonly<Record<string, readonly [NatureStat, NatureStat] | undefined>> = {
  hardy: undefined,
  lonely: ["attack", "defense"],
  brave: ["attack", "speed"],
  adamant: ["attack", "special-attack"],
  naughty: ["attack", "special-defense"],
  bold: ["defense", "attack"],
  docile: undefined,
  relaxed: ["defense", "speed"],
  impish: ["defense", "special-attack"],
  lax: ["defense", "special-defense"],
  timid: ["speed", "attack"],
  hasty: ["speed", "defense"],
  serious: undefined,
  jolly: ["speed", "special-attack"],
  naive: ["speed", "special-defense"],
  modest: ["special-attack", "attack"],
  mild: ["special-attack", "defense"],
  quiet: ["special-attack", "speed"],
  bashful: undefined,
  rash: ["special-attack", "special-defense"],
  calm: ["special-defense", "attack"],
  gentle: ["special-defense", "defense"],
  sassy: ["special-defense", "speed"],
  careful: ["special-defense", "special-attack"],
  quirky: undefined,
};

function normaliseNatureId(value: string): string {
  return value.trim().toLowerCase().replaceAll("_", "-").replaceAll(" ", "-");
}

export function formatNatureName(natureId: string): string {
  const id = normaliseNatureId(natureId);
  return id
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getHgssNatureEffect(natureId: string): HgssNatureEffect {
  const id = normaliseNatureId(natureId);
  const effect = NATURE_EFFECTS[id];
  return {
    id,
    name: formatNatureName(id),
    ...(effect ? { increasedStat: effect[0], decreasedStat: effect[1] } : {}),
  };
}

export function formatNatureStat(stat: NatureStat): string {
  switch (stat) {
    case "attack":
      return "Attack";
    case "defense":
      return "Defense";
    case "special-attack":
      return "Sp. Atk";
    case "special-defense":
      return "Sp. Def";
    case "speed":
      return "Speed";
  }
}

function baseStatFor(stats: HgssPokemonBaseStats, stat: NatureStat): number {
  switch (stat) {
    case "attack":
      return stats.attack;
    case "defense":
      return stats.defense;
    case "special-attack":
      return stats.specialAttack;
    case "special-defense":
      return stats.specialDefense;
    case "speed":
      return stats.speed;
  }
}

function relevanceFor(
  stat: NatureStat,
  stats: HgssPokemonBaseStats,
  moves: readonly HgssMovePlannerData[],
): number {
  const maxStat = Math.max(
    stats.attack,
    stats.defense,
    stats.specialAttack,
    stats.specialDefense,
    stats.speed,
  );
  const baseRelevance = baseStatFor(stats, stat) / Math.max(1, maxStat);
  const damaging = moves.filter((move) => move.damageClass !== "status");
  if (!damaging.length) return baseRelevance;

  const physicalShare =
    damaging.filter((move) => move.damageClass === "physical").length / damaging.length;
  const specialShare =
    damaging.filter((move) => move.damageClass === "special").length / damaging.length;

  if (stat === "attack") return baseRelevance * 0.55 + physicalShare * 0.45;
  if (stat === "special-attack") return baseRelevance * 0.55 + specialShare * 0.45;
  return baseRelevance;
}

/**
 * Nature fit is intentionally contextual rather than an absolute judgement.
 * Current move categories influence offensive stats when available; otherwise
 * the current species' base-stat profile is used as the fallback signal.
 */
export function getHgssNatureFit(
  natureId: string | undefined,
  context: { baseStats?: HgssPokemonBaseStats; moves?: readonly HgssMovePlannerData[] } = {},
): HgssNatureFit {
  if (!natureId) return { tone: "neutral", score: 0, reason: "No nature is recorded." };
  const nature = getHgssNatureEffect(natureId);
  if (!nature.increasedStat || !nature.decreasedStat) {
    return { tone: "neutral", score: 0, reason: `${nature.name} has no stat changes.` };
  }
  if (!context.baseStats) {
    return {
      tone: "neutral",
      score: 0,
      reason: `${nature.name} changes ${formatNatureStat(nature.increasedStat)} and ${formatNatureStat(nature.decreasedStat)}, but no stat profile is available for fit scoring.`,
    };
  }

  const moves = context.moves ?? [];
  const boosted = relevanceFor(nature.increasedStat, context.baseStats, moves);
  const lowered = relevanceFor(nature.decreasedStat, context.baseStats, moves);
  const delta = boosted - lowered;
  const tone: NatureFitTone = delta >= 0.12 ? "positive" : delta <= -0.12 ? "negative" : "neutral";
  const score = tone === "positive" ? 1 : tone === "negative" ? -1 : 0;
  const reason =
    tone === "positive"
      ? `${nature.name} is a good fit here: it boosts ${formatNatureStat(nature.increasedStat)}, which is more relevant to the current stat/move profile than the lowered ${formatNatureStat(nature.decreasedStat)}.`
      : tone === "negative"
        ? `${nature.name} is a poor fit here: it lowers ${formatNatureStat(nature.decreasedStat)}, which is more relevant to the current stat/move profile than the boosted ${formatNatureStat(nature.increasedStat)}.`
        : `${nature.name} is roughly neutral for this Pokémon's current stat/move profile.`;

  return { tone, score, reason };
}
