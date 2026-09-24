import { describe, expect, it } from "vitest";
import {
  HGSS_BADGE_KEYS,
  HGSS_CAPABILITY_KEYS,
  HGSS_MILESTONE_KEYS,
  HgssLocationSchema,
  createInitialHgssProgressionState,
  isHgssProgressionFlag,
} from "../src/index";

describe("HGSS Step 2 data contract", () => {
  it("starts every fixed progression flag as false", () => {
    const state = createInitialHgssProgressionState();

    expect(Object.values(state.badges).every((value) => value === false)).toBe(true);
    expect(Object.values(state.capabilities).every((value) => value === false)).toBe(true);
    expect(Object.values(state.milestones).every((value) => value === false)).toBe(true);
  });

  it("keeps progression IDs fixed and discoverable", () => {
    expect(HGSS_BADGE_KEYS).toContain("rising");
    expect(HGSS_CAPABILITY_KEYS).toContain("surf");
    expect(HGSS_CAPABILITY_KEYS).toContain("oldRod");
    expect(HGSS_CAPABILITY_KEYS).toContain("headbutt");
    expect(HGSS_MILESTONE_KEYS).toContain("radioTowerCleared");
    expect(isHgssProgressionFlag("milestone", "radioTowerCleared")).toBe(true);
    expect(isHgssProgressionFlag("milestone", "radio-tower-cleared")).toBe(false);
  });

  it("validates location requirements against the fixed progression IDs", () => {
    const location = HgssLocationSchema.safeParse({
      id: "route-44",
      name: "Route 44",
      region: "johto",
      kind: "route",
      mainGame: true,
      order: 44,
      availability: {
        anyOf: [
          {
            allOf: [
              {
                kind: "milestone",
                key: "radioTowerCleared",
                value: true,
              },
            ],
          },
        ],
      },
      map: {
        anchor: { x: 0.7, y: 0.3 },
        shapeId: "route-44",
      },
      opportunities: [
        {
          id: "route-44-main",
          label: "Main encounter",
          kind: "wild",
          defaultEnabled: true,
        },
      ],
    });

    expect(location.success).toBe(true);
  });

  it("rejects unknown progression IDs in location requirements", () => {
    const location = HgssLocationSchema.safeParse({
      id: "route-44",
      name: "Route 44",
      region: "johto",
      kind: "route",
      mainGame: true,
      order: 44,
      availability: {
        anyOf: [
          {
            allOf: [
              {
                kind: "milestone",
                key: "radioTowerDone",
              },
            ],
          },
        ],
      },
      map: {
        anchor: { x: 0.7, y: 0.3 },
      },
      opportunities: [],
    });

    expect(location.success).toBe(false);
  });
});
