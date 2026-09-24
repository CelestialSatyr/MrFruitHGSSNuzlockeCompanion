import { z } from "zod";

export const HGSS_BADGE_KEYS = [
  "zephyr",
  "hive",
  "plain",
  "fog",
  "storm",
  "mineral",
  "glacier",
  "rising",
] as const;

export const HGSS_CAPABILITY_KEYS = [
  "cut",
  "fly",
  "surf",
  "strength",
  "flash",
  "whirlpool",
  "waterfall",
  "rockSmash",
  "oldRod",
  "goodRod",
  "headbutt",
] as const;

export const HGSS_MILESTONE_KEYS = [
  "starterReceived",
  "mysteryEggDeliveredToElm",
  "mysteryEggReceived",
  "slowpokeWellCleared",
  "ilexForestFarfetchdResolved",
  "sudowoodoCleared",
  "burnedTowerVisited",
  "secretMedicineObtained",
  "lighthouseMedicineDelivered",
  "redGyaradosResolved",
  "rocketHQCleared",
  "radioTowerCleared",
  "blackthornGymDefeated",
  "dragonsDenCleared",
  "kimonoGirlsDefeated",
  "towerLegendaryResolved",
  "pokemonLeagueGateCleared",
  "eliteFourDefeated",
] as const;

export const HgssBadgeKeySchema = z.enum(HGSS_BADGE_KEYS);
export const HgssCapabilityKeySchema = z.enum(HGSS_CAPABILITY_KEYS);
export const HgssMilestoneKeySchema = z.enum(HGSS_MILESTONE_KEYS);

export const HgssProgressionStateSchema = z
  .object({
    badges: z
      .object({
        zephyr: z.boolean(),
        hive: z.boolean(),
        plain: z.boolean(),
        fog: z.boolean(),
        storm: z.boolean(),
        mineral: z.boolean(),
        glacier: z.boolean(),
        rising: z.boolean(),
      })
      .strict(),
    capabilities: z
      .object({
        cut: z.boolean(),
        fly: z.boolean(),
        surf: z.boolean(),
        strength: z.boolean(),
        flash: z.boolean(),
        whirlpool: z.boolean(),
        waterfall: z.boolean(),
        rockSmash: z.boolean(),
        oldRod: z.boolean(),
        goodRod: z.boolean(),
        headbutt: z.boolean(),
      })
      .strict(),
    milestones: z
      .object({
        starterReceived: z.boolean(),
        mysteryEggDeliveredToElm: z.boolean(),
        mysteryEggReceived: z.boolean(),
        slowpokeWellCleared: z.boolean(),
        ilexForestFarfetchdResolved: z.boolean(),
        sudowoodoCleared: z.boolean(),
        burnedTowerVisited: z.boolean(),
        secretMedicineObtained: z.boolean(),
        lighthouseMedicineDelivered: z.boolean(),
        redGyaradosResolved: z.boolean(),
        rocketHQCleared: z.boolean(),
        radioTowerCleared: z.boolean(),
        blackthornGymDefeated: z.boolean(),
        dragonsDenCleared: z.boolean(),
        kimonoGirlsDefeated: z.boolean(),
        towerLegendaryResolved: z.boolean(),
        pokemonLeagueGateCleared: z.boolean(),
        eliteFourDefeated: z.boolean(),
      })
      .strict(),
  })
  .strict();

export type HgssBadgeKey = z.infer<typeof HgssBadgeKeySchema>;
export type HgssCapabilityKey = z.infer<typeof HgssCapabilityKeySchema>;
export type HgssMilestoneKey = z.infer<typeof HgssMilestoneKeySchema>;
export type HgssProgressionState = z.infer<typeof HgssProgressionStateSchema>;

export type HgssProgressionKind = "badge" | "capability" | "milestone";

export function createInitialHgssProgressionState(): HgssProgressionState {
  return {
    badges: {
      zephyr: false,
      hive: false,
      plain: false,
      fog: false,
      storm: false,
      mineral: false,
      glacier: false,
      rising: false,
    },
    capabilities: {
      cut: false,
      fly: false,
      surf: false,
      strength: false,
      flash: false,
      whirlpool: false,
      waterfall: false,
      rockSmash: false,
      oldRod: false,
      goodRod: false,
      headbutt: false,
    },
    milestones: {
      starterReceived: false,
      mysteryEggDeliveredToElm: false,
      mysteryEggReceived: false,
      slowpokeWellCleared: false,
      ilexForestFarfetchdResolved: false,
      sudowoodoCleared: false,
      burnedTowerVisited: false,
      secretMedicineObtained: false,
      lighthouseMedicineDelivered: false,
      redGyaradosResolved: false,
      rocketHQCleared: false,
      radioTowerCleared: false,
      blackthornGymDefeated: false,
      dragonsDenCleared: false,
      kimonoGirlsDefeated: false,
      towerLegendaryResolved: false,
      pokemonLeagueGateCleared: false,
      eliteFourDefeated: false,
    },
  };
}

export function isHgssProgressionFlag(kind: HgssProgressionKind, id: string): boolean {
  if (kind === "badge") return HgssBadgeKeySchema.safeParse(id).success;
  if (kind === "capability") return HgssCapabilityKeySchema.safeParse(id).success;
  return HgssMilestoneKeySchema.safeParse(id).success;
}
