import { describe, expect, it } from "vitest";
import {
  HGSS_MAIN_STORY_CONNECTIONS,
  HGSS_MAIN_STORY_LOCATIONS,
  createInitialHgssProgressionState,
  getHgssLocationAvailability,
  getHgssOpportunityState,
} from "../src/index";

function location(id: string) {
  const found = HGSS_MAIN_STORY_LOCATIONS.find((entry) => entry.id === id);
  if (!found) throw new Error(`Missing HGSS test location ${id}`);
  return found;
}

describe("HGSS main-story map data", () => {
  it("uses unique location, shape, and encounter-opportunity IDs", () => {
    const locationIds = HGSS_MAIN_STORY_LOCATIONS.map((entry) => entry.id);
    const shapeIds = HGSS_MAIN_STORY_LOCATIONS.map((entry) => entry.map.shapeId).filter(Boolean);
    const opportunityIds = HGSS_MAIN_STORY_LOCATIONS.flatMap((entry) =>
      entry.opportunities.map((opportunity) => opportunity.id),
    );

    expect(new Set(locationIds).size).toBe(locationIds.length);
    expect(new Set(shapeIds).size).toBe(shapeIds.length);
    expect(new Set(opportunityIds).size).toBe(opportunityIds.length);
  });

  it("keeps every map connection inside the canonical location catalogue", () => {
    const ids = new Set(HGSS_MAIN_STORY_LOCATIONS.map((entry) => entry.id));
    for (const connection of HGSS_MAIN_STORY_CONNECTIONS) {
      expect(ids.has(connection.from)).toBe(true);
      expect(ids.has(connection.to)).toBe(true);
    }
  });

  it("makes the early Route 46 encounter reachable from the start", () => {
    const progression = createInitialHgssProgressionState();
    expect(getHgssLocationAvailability(location("route-46"), progression)).toBe("available");
  });

  it("does not unlock Route 32 until the Zephyr Badge is earned", () => {
    const progression = createInitialHgssProgressionState();
    expect(getHgssLocationAvailability(location("route-32"), progression)).toBe("locked");
    progression.badges.zephyr = true;
    expect(getHgssLocationAvailability(location("route-32"), progression)).toBe("available");
  });

  it("requires Surf plus the Fog Badge for the sea route to Cianwood", () => {
    const progression = createInitialHgssProgressionState();
    const route41 = location("route-41");

    progression.badges.fog = true;
    expect(getHgssLocationAvailability(route41, progression)).toBe("locked");

    progression.capabilities.surf = true;
    expect(getHgssLocationAvailability(route41, progression)).toBe("available");
  });

  it("does not unlock Route 44 until the first seven badges and Radio Tower clear are recorded", () => {
    const progression = createInitialHgssProgressionState();
    const route44 = location("route-44");

    for (const badge of [
      "zephyr",
      "hive",
      "plain",
      "fog",
      "storm",
      "mineral",
      "glacier",
    ] as const) {
      progression.badges[badge] = true;
    }
    expect(getHgssLocationAvailability(route44, progression)).toBe("locked");

    progression.milestones.radioTowerCleared = true;
    expect(getHgssLocationAvailability(route44, progression)).toBe("available");
  });

  it("keeps optional gifts and statics rules-dependent instead of falsely calling them available", () => {
    const progression = createInitialHgssProgressionState();
    progression.badges.zephyr = true;
    const violet = location("violet-city");
    const gift = violet.opportunities.find((opportunity) => opportunity.id === "violet-togepi-egg");
    if (!gift) throw new Error("Missing Togepi gift opportunity");

    expect(getHgssOpportunityState(violet, gift, progression, undefined).availability).toBe(
      "rule-dependent",
    );
  });

  it("does not advertise fishing-only city encounters before a rod or Surf is recorded", () => {
    const progression = createInitialHgssProgressionState();
    const cherrygrove = location("cherrygrove-city");
    const encounter = cherrygrove.opportunities.find(
      (opportunity) => opportunity.id === "cherrygrove-main",
    );
    if (!encounter) throw new Error("Missing Cherrygrove encounter opportunity");

    expect(
      getHgssOpportunityState(cherrygrove, encounter, progression, undefined).availability,
    ).toBe("locked");
    progression.capabilities.oldRod = true;
    expect(
      getHgssOpportunityState(cherrygrove, encounter, progression, undefined).availability,
    ).toBe("available");
  });

  it("keeps Whirl Islands locked until Surf and Whirlpool are both usable", () => {
    const progression = createInitialHgssProgressionState();
    const whirlIslands = location("whirl-islands");

    progression.badges.fog = true;
    progression.capabilities.surf = true;
    expect(getHgssLocationAvailability(whirlIslands, progression)).toBe("locked");

    progression.capabilities.whirlpool = true;
    expect(getHgssLocationAvailability(whirlIslands, progression)).toBe("locked");

    progression.badges.glacier = true;
    expect(getHgssLocationAvailability(whirlIslands, progression)).toBe("available");
  });

  it("allows an Ice Path encounter before Strength but does not call Blackthorn reachable yet", () => {
    const progression = createInitialHgssProgressionState();
    for (const badge of [
      "zephyr",
      "hive",
      "plain",
      "fog",
      "storm",
      "mineral",
      "glacier",
    ] as const) {
      progression.badges[badge] = true;
    }
    progression.milestones.radioTowerCleared = true;

    expect(getHgssLocationAvailability(location("ice-path"), progression)).toBe("available");
    expect(getHgssLocationAvailability(location("blackthorn-city"), progression)).toBe("locked");

    progression.capabilities.strength = true;
    expect(getHgssLocationAvailability(location("blackthorn-city"), progression)).toBe("available");
  });
});
