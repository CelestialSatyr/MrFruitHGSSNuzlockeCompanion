import { describe, expect, it } from "vitest";
import { parseRunDataset, validateRunDatasetSemantics } from "@nuzlocke/core";
import {
  buildHgssEncounterPlanner,
  getHgssOpportunityState,
  hgssGameStateAdapter,
  reconstructHgssRun,
  type HgssLocation,
} from "../src/index";

function progressionDataset() {
  return parseRunDataset({
    run: {
      schemaVersion: 1,
      id: "hgss-test-run",
      title: "HGSS Test Run",
      gameId: "heartgold-soulsilver",
      status: "active",
      scope: "main-story",
      playerIds: ["player_fruit", "player_two"],
    },
    players: [
      { id: "player_fruit", displayName: "Fruit", gameVersionId: "heartgold" },
      { id: "player_two", displayName: "Two", gameVersionId: "soulsilver" },
    ],
    episodes: [{ id: "ep_0001", number: 1, status: "published" }],
    pokemon: [],
    soulLinks: [],
    rules: [],
    tags: [],
    events: [
      {
        id: "evt_0001",
        episodeId: "ep_0001",
        sequence: 1,
        type: "gym-battle",
        tone: "positive",
        importance: "major",
        gymId: "violet-gym",
        leaderName: "Falkner",
        result: "win",
        participantPokemonIds: ["pkm_9999"],
        badgeId: "zephyr",
      },
      {
        id: "evt_0002",
        episodeId: "ep_0001",
        sequence: 2,
        type: "progression-changed",
        tone: "neutral",
        importance: "normal",
        flag: { kind: "capability", id: "surf", value: true },
      },
      {
        id: "evt_0003",
        episodeId: "ep_0001",
        sequence: 3,
        type: "progression-changed",
        tone: "neutral",
        importance: "normal",
        flag: { kind: "milestone", id: "radioTowerCleared", value: true },
      },
    ],
  });
}

describe("HGSS state integration", () => {
  it("maps Gym badges and progression events into the fixed boolean state", () => {
    const state = reconstructHgssRun(progressionDataset());

    expect(state.game.badges.zephyr).toBe(true);
    expect(state.game.capabilities.surf).toBe(true);
    expect(state.game.milestones.radioTowerCleared).toBe(true);
    expect(state.game.badges.hive).toBe(false);
  });

  it("rejects unknown HGSS progression IDs during semantic validation", () => {
    const dataset = progressionDataset();
    const bad = {
      ...dataset,
      events: dataset.events.map((event) =>
        event.id === "evt_0002" && event.type === "progression-changed"
          ? { ...event, flag: { kind: "capability" as const, id: "teleport", value: true } }
          : event,
      ),
    };

    const result = validateRunDatasetSemantics(bad, hgssGameStateAdapter);
    expect(result.errors.some((issue) => issue.code === "unknown-progression-flag")).toBe(true);
  });

  it("evaluates location and opportunity availability from progression state", () => {
    const state = reconstructHgssRun(progressionDataset());
    const location: HgssLocation = {
      id: "test-lake",
      name: "Test Lake",
      region: "johto",
      kind: "landmark",
      mainGame: true,
      order: 1,
      availability: {
        anyOf: [{ allOf: [{ kind: "capability", key: "surf", value: true }] }],
      },
      map: { anchor: { x: 0.5, y: 0.5 } },
      opportunities: [
        {
          id: "test-lake-main",
          label: "Main encounter",
          kind: "wild",
          defaultEnabled: true,
        },
      ],
    };

    const opportunity = location.opportunities[0];
    expect(opportunity).toBeDefined();
    if (opportunity === undefined) return;

    expect(getHgssOpportunityState(location, opportunity, state.game, undefined).availability).toBe(
      "available",
    );
  });
  it("builds the encounter planner from progression plus recorded resolutions", () => {
    const state = reconstructHgssRun(progressionDataset());
    const locations: HgssLocation[] = [
      {
        id: "open-route",
        name: "Open Route",
        region: "johto",
        kind: "route",
        mainGame: true,
        order: 1,
        map: { anchor: { x: 0.2, y: 0.2 } },
        opportunities: [
          {
            id: "open-route-main",
            label: "Main encounter",
            kind: "wild",
            defaultEnabled: true,
          },
        ],
      },
      {
        id: "locked-route",
        name: "Locked Route",
        region: "johto",
        kind: "route",
        mainGame: true,
        order: 2,
        availability: {
          anyOf: [{ allOf: [{ kind: "badge", key: "rising", value: true }] }],
        },
        map: { anchor: { x: 0.3, y: 0.3 } },
        opportunities: [
          {
            id: "locked-route-main",
            label: "Main encounter",
            kind: "wild",
            defaultEnabled: true,
          },
        ],
      },
    ];

    expect(buildHgssEncounterPlanner(locations, state).map((entry) => entry.availability)).toEqual([
      "available",
      "locked",
    ]);
  });
});
