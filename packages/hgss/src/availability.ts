import {
  encounterResolutionKey,
  type EncounterResolutionState,
  type RunState,
} from "@nuzlocke/core";
import type { HgssAvailability, HgssEncounterOpportunity, HgssLocation } from "./locations.ts";
import type { HgssProgressionState } from "./progression.ts";

export type HgssLocationAvailability = "locked" | "available";
export type HgssOpportunityAvailability =
  "locked" | "available" | "caught" | "failed" | "skipped" | "rule-dependent";

export interface HgssOpportunityState {
  location: HgssLocation;
  opportunity: HgssEncounterOpportunity;
  availability: HgssOpportunityAvailability;
  resolution: EncounterResolutionState | undefined;
}

export function isHgssAvailabilitySatisfied(
  availability: HgssAvailability | undefined,
  progression: HgssProgressionState,
): boolean {
  if (availability === undefined) return true;
  return availability.anyOf.some((group) =>
    group.allOf.every((condition) => {
      switch (condition.kind) {
        case "badge":
          return progression.badges[condition.key] === condition.value;
        case "capability":
          return progression.capabilities[condition.key] === condition.value;
        case "milestone":
          return progression.milestones[condition.key] === condition.value;
      }
    }),
  );
}

export function getHgssLocationAvailability(
  location: HgssLocation,
  progression: HgssProgressionState,
): HgssLocationAvailability {
  return isHgssAvailabilitySatisfied(location.availability, progression) ? "available" : "locked";
}

export function getHgssOpportunityState(
  location: HgssLocation,
  opportunity: HgssEncounterOpportunity,
  progression: HgssProgressionState,
  resolution: EncounterResolutionState | undefined,
): HgssOpportunityState {
  if (resolution !== undefined) {
    return {
      location,
      opportunity,
      availability: resolution.status,
      resolution,
    };
  }

  const locationAvailable = isHgssAvailabilitySatisfied(location.availability, progression);
  const opportunityAvailable = isHgssAvailabilitySatisfied(opportunity.availability, progression);

  return {
    location,
    opportunity,
    availability:
      !locationAvailable || !opportunityAvailable
        ? "locked"
        : opportunity.defaultEnabled
          ? "available"
          : "rule-dependent",
    resolution: undefined,
  };
}

export function buildHgssEncounterPlanner(
  locations: readonly HgssLocation[],
  state: RunState<HgssProgressionState>,
  options: { mainGameOnly?: boolean | undefined } = {},
): HgssOpportunityState[] {
  const mainGameOnly = options.mainGameOnly ?? true;
  const results: HgssOpportunityState[] = [];

  for (const location of locations) {
    if (mainGameOnly && !location.mainGame) continue;
    for (const opportunity of location.opportunities) {
      const resolution = state.encounters.get(encounterResolutionKey(location.id, opportunity.id));
      results.push(getHgssOpportunityState(location, opportunity, state.game, resolution));
    }
  }

  return results.sort(
    (left, right) =>
      left.location.order - right.location.order ||
      left.opportunity.label.localeCompare(right.opportunity.label),
  );
}

export function selectAvailableHgssEncounters(
  locations: readonly HgssLocation[],
  state: RunState<HgssProgressionState>,
): HgssOpportunityState[] {
  return buildHgssEncounterPlanner(locations, state).filter(
    (entry) => entry.availability === "available",
  );
}
