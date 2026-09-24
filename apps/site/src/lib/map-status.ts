import {
  getHgssLocationAvailability,
  type HgssLocation,
  type HgssOpportunityState,
  type HgssProgressionState,
} from "@nuzlocke/hgss";
import type { RunState } from "@nuzlocke/core";

export type MapLocationStatus =
  | "available"
  | "caught"
  | "lost"
  | "failed"
  | "skipped"
  | "rule-dependent"
  | "locked"
  | "navigation";

export type MapStatusVisualKey =
  "available" | "caught" | "failed" | "skipped" | "rule-dependent" | "navigation" | "locked";

export interface MapStatusDefinition {
  key: MapStatusVisualKey;
  label: string;
  description: string;
  cssVariable: string;
}

/**
 * Single source of truth for every status color shown by the map, its legend,
 * the location peek and the Encounter Planner.
 */
export const MAP_STATUS_DEFINITIONS: readonly MapStatusDefinition[] = [
  {
    key: "available",
    label: "Available",
    description: "An encounter can be used now.",
    cssVariable: "--map-status-available",
  },
  {
    key: "caught",
    label: "Completed",
    description: "The encounter was completed successfully.",
    cssVariable: "--map-status-caught",
  },
  {
    key: "failed",
    label: "Lost / failed",
    description: "The encounter failed or its resulting Soul Link was lost.",
    cssVariable: "--map-status-failed",
  },
  {
    key: "skipped",
    label: "Skipped",
    description: "The encounter was intentionally skipped.",
    cssVariable: "--map-status-skipped",
  },
  {
    key: "rule-dependent",
    label: "Rules-dependent",
    description: "Whether this encounter can be used depends on the run rules.",
    cssVariable: "--map-status-rule-dependent",
  },
  {
    key: "navigation",
    label: "Reachable",
    description: "The location is reachable, but no encounter is currently available here.",
    cssVariable: "--map-status-navigation",
  },
  {
    key: "locked",
    label: "Locked",
    description: "The location is not reachable yet.",
    cssVariable: "--map-status-locked",
  },
] as const;

export function mapStatusVisualKey(status: MapLocationStatus): MapStatusVisualKey {
  return status === "lost" ? "failed" : status;
}

export function mapStatusLegendLabel(status: MapLocationStatus): string {
  return (
    MAP_STATUS_DEFINITIONS.find((entry) => entry.key === mapStatusVisualKey(status))?.label ??
    status
  );
}

export function mapStatusLabel(status: MapLocationStatus): string {
  if (status === "lost") return "Link lost";
  const definition = MAP_STATUS_DEFINITIONS.find(
    (entry) => entry.key === mapStatusVisualKey(status),
  );
  if (!definition) return status;
  if (status === "failed") return "Encounter failed";
  if (status === "caught") return "Encounter completed";
  if (status === "skipped") return "Encounter skipped";
  if (status === "rule-dependent") return "Depends on run rules";
  if (status === "navigation") return "Reachable";
  if (status === "locked") return "Not reachable yet";
  return "Encounter available";
}

export function deriveMapLocationStatus(
  location: HgssLocation,
  entries: readonly HgssOpportunityState[],
  state: RunState<HgssProgressionState>,
): MapLocationStatus {
  if (entries.some((entry) => entry.availability === "available")) return "available";

  const caught = entries.filter((entry) => entry.availability === "caught");
  if (caught.length > 0) {
    const hasLostLink = caught.some((entry) => {
      const linkId = entry.resolution?.soulLinkId;
      if (!linkId) return false;
      const link = state.soulLinks.get(linkId);
      return link?.status === "lost" || link?.status === "retired";
    });
    return hasLostLink ? "lost" : "caught";
  }

  if (entries.some((entry) => entry.availability === "failed")) return "failed";
  if (entries.some((entry) => entry.availability === "skipped")) return "skipped";
  if (entries.some((entry) => entry.availability === "rule-dependent")) return "rule-dependent";

  return getHgssLocationAvailability(location, state.game) === "available"
    ? "navigation"
    : "locked";
}
