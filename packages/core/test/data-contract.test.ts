import { describe, expect, it } from "vitest";
import {
  EpisodeSchema,
  EventIdSchema,
  PokemonSchema,
  RuleSchema,
  RunDatasetSchema,
  RunEventSchema,
  RunSchema,
  SoulLinkSchema,
} from "../src/index";

const baseEvent = {
  id: "evt_0001",
  episodeId: "ep_0001",
  sequence: 1,
  videoTimestampSeconds: 742,
  tone: "positive" as const,
  importance: "normal" as const,
};

describe("Step 2 data contract", () => {
  it("uses stable opaque event IDs", () => {
    expect(EventIdSchema.safeParse("evt_0042").success).toBe(true);
    expect(EventIdSchema.safeParse("luc-ampharos-died").success).toBe(false);
  });

  it("allows planning runs before both players are known", () => {
    expect(
      RunSchema.safeParse({
        schemaVersion: 1,
        id: "mr-fruit-hgss-soul-link",
        title: "Mr Fruit HGSS Soul Link",
        gameId: "heartgold-soulsilver",
        status: "planning",
        scope: "main-story",
        playerIds: [],
      }).success,
    ).toBe(true);
  });

  it("requires two players once a run becomes active", () => {
    expect(
      RunSchema.safeParse({
        schemaVersion: 1,
        id: "mr-fruit-hgss-soul-link",
        title: "Mr Fruit HGSS Soul Link",
        gameId: "heartgold-soulsilver",
        status: "active",
        scope: "main-story",
        playerIds: ["player_fruit"],
      }).success,
    ).toBe(false);
  });

  it("stores imported YouTube metadata on episodes", () => {
    const result = EpisodeSchema.safeParse({
      id: "ep_0001",
      number: 1,
      status: "published",
      youtube: {
        videoId: "abc123",
        url: "https://www.youtube.com/watch?v=abc123",
        title: "Episode One",
        description: "The run begins.",
        channelTitle: "Mr. Fruit",
        publishedAt: "2026-09-23T17:00:00Z",
        durationSeconds: 4567,
        thumbnail: {
          url: "https://i.ytimg.com/vi/abc123/maxresdefault.jpg",
          width: 1280,
          height: 720,
        },
      },
    });

    expect(result.success).toBe(true);
  });

  it("keeps YouTube timestamps on the event itself", () => {
    const result = RunEventSchema.safeParse({
      ...baseEvent,
      type: "special-moment",
      title: "The one HP dream",
      description: "A Pokémon survives on exactly one HP.",
      pokemonIds: ["pkm_0001"],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.videoTimestampSeconds).toBe(742);
    }
  });

  it("requires a successful paired encounter to create a Soul Link", () => {
    const result = RunEventSchema.safeParse({
      ...baseEvent,
      type: "encounter",
      locationId: "route-32",
      opportunityId: "route-32-main",
      acquisitionType: "wild",
      outcomes: [
        {
          result: "caught",
          playerId: "player_fruit",
          pokemonId: "pkm_0001",
          speciesId: 179,
        },
        {
          result: "caught",
          playerId: "player_two",
          pokemonId: "pkm_0002",
          speciesId: 92,
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("rejects a Soul Link on a failed paired encounter", () => {
    const result = RunEventSchema.safeParse({
      ...baseEvent,
      type: "encounter",
      locationId: "route-32",
      opportunityId: "route-32-main",
      acquisitionType: "wild",
      soulLinkId: "link_0001",
      outcomes: [
        {
          result: "caught",
          playerId: "player_fruit",
          pokemonId: "pkm_0001",
          speciesId: 179,
        },
        {
          result: "failed",
          playerId: "player_two",
          speciesId: 92,
          reason: "The encounter fainted.",
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("supports persistent Pokémon and Soul Link identities", () => {
    expect(
      PokemonSchema.safeParse({
        id: "pkm_0001",
        playerId: "player_fruit",
        createdByEventId: "evt_0001",
        initialSpeciesId: 179,
        gender: "female",
        shiny: false,
      }).success,
    ).toBe(true);

    expect(
      SoulLinkSchema.safeParse({
        id: "link_0001",
        pokemonIds: ["pkm_0001", "pkm_0002"],
        createdByEventId: "evt_0001",
      }).success,
    ).toBe(true);
  });

  it("requires rule revisions to be chronological", () => {
    expect(
      RuleSchema.safeParse({
        id: "species-clause",
        title: "Species Clause",
        category: "encounters",
        shortSummary: "Duplicates may be rerolled.",
        versions: [
          {
            effectiveFromEpisode: 3,
            summary: "Updated",
            description: "Updated rule.",
          },
          {
            effectiveFromEpisode: 1,
            summary: "Original",
            description: "Original rule.",
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("can parse an empty planning dataset before the run begins", () => {
    const result = RunDatasetSchema.safeParse({
      run: {
        schemaVersion: 1,
        id: "mr-fruit-hgss-soul-link",
        title: "Mr Fruit HGSS Soul Link",
        gameId: "heartgold-soulsilver",
        status: "planning",
        scope: "main-story",
        playerIds: [],
      },
      players: [],
      episodes: [],
      pokemon: [],
      soulLinks: [],
      rules: [],
      tags: [],
      events: [],
    });

    expect(result.success).toBe(true);
  });
});
