import type { RunState } from "@nuzlocke/core";
import {
  HGSS_BADGE_KEYS,
  HGSS_CAPABILITY_KEYS,
  HGSS_MILESTONE_KEYS,
  type HgssBadgeKey,
  type HgssCapabilityKey,
  type HgssMilestoneKey,
  type HgssProgressionState,
} from "@nuzlocke/hgss";

export interface MapProgressOverrides {
  badges: HgssBadgeKey[];
  capabilities: HgssCapabilityKey[];
  milestones: HgssMilestoneKey[];
}

export const EMPTY_MAP_OVERRIDES: MapProgressOverrides = {
  badges: [],
  capabilities: [],
  milestones: [],
};

export function parseMapProgressOverrides(value: unknown): MapProgressOverrides {
  const raw = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const badges = Array.isArray(raw.badges)
    ? raw.badges.filter(
        (key): key is HgssBadgeKey =>
          typeof key === "string" && HGSS_BADGE_KEYS.includes(key as HgssBadgeKey),
      )
    : [];
  const capabilities = Array.isArray(raw.capabilities)
    ? raw.capabilities.filter(
        (key): key is HgssCapabilityKey =>
          typeof key === "string" && HGSS_CAPABILITY_KEYS.includes(key as HgssCapabilityKey),
      )
    : [];
  const milestones = Array.isArray(raw.milestones)
    ? raw.milestones.filter(
        (key): key is HgssMilestoneKey =>
          typeof key === "string" && HGSS_MILESTONE_KEYS.includes(key as HgssMilestoneKey),
      )
    : [];
  return { badges, capabilities, milestones };
}

export function pruneMapProgressOverrides(
  state: RunState<HgssProgressionState>,
  overrides: MapProgressOverrides,
): MapProgressOverrides {
  return {
    badges: overrides.badges.filter((key) => !state.game.badges[key]),
    capabilities: overrides.capabilities.filter((key) => !state.game.capabilities[key]),
    milestones: overrides.milestones.filter((key) => !state.game.milestones[key]),
  };
}

export function applyMapProgressOverrides(
  state: RunState<HgssProgressionState>,
  overrides: MapProgressOverrides,
): RunState<HgssProgressionState> {
  const badges = { ...state.game.badges };
  const capabilities = { ...state.game.capabilities };
  const milestones = { ...state.game.milestones };
  for (const key of overrides.badges) badges[key] = true;
  for (const key of overrides.capabilities) capabilities[key] = true;
  for (const key of overrides.milestones) milestones[key] = true;

  const earnedBadgeIds = new Set(state.earnedBadgeIds);
  for (const key of overrides.badges) earnedBadgeIds.add(key);

  return {
    ...state,
    game: { badges, capabilities, milestones },
    earnedBadgeIds,
  };
}
