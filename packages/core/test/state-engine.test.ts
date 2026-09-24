import { describe, expect, it } from "vitest";
import {
  parseRunDataset,
  reconstructRun,
  selectHighlights,
  selectPokemonHistory,
  selectSoulLinkHistory,
  validateRunDatasetSemantics,
  type RunDataset,
} from "../src/index";

function makeDataset(): RunDataset {
  return parseRunDataset({
    run: {
      schemaVersion: 1,
      id: "mr-fruit-hgss-soul-link",
      title: "Mr Fruit HGSS Soul Link",
      gameId: "heartgold-soulsilver",
      status: "active",
      scope: "main-story",
      playerIds: ["player_fruit", "player_two"],
    },
    players: [
      {
        id: "player_fruit",
        displayName: "Mr Fruit",
        gameVersionId: "heartgold",
      },
      {
        id: "player_two",
        displayName: "Player Two",
        gameVersionId: "soulsilver",
      },
    ],
    episodes: [
      { id: "ep_0001", number: 1, status: "published" },
      { id: "ep_0002", number: 2, status: "published" },
      { id: "ep_0003", number: 3, status: "draft" },
    ],
    pokemon: [
      {
        id: "pkm_0001",
        playerId: "player_fruit",
        createdByEventId: "evt_0001",
        initialSpeciesId: 179,
      },
      {
        id: "pkm_0002",
        playerId: "player_two",
        createdByEventId: "evt_0001",
        initialSpeciesId: 92,
      },
      {
        id: "pkm_0003",
        playerId: "player_fruit",
        createdByEventId: "evt_0007",
        initialSpeciesId: 155,
      },
      {
        id: "pkm_0004",
        playerId: "player_two",
        createdByEventId: "evt_0007",
        initialSpeciesId: 158,
      },
    ],
    soulLinks: [
      {
        id: "link_0001",
        pokemonIds: ["pkm_0001", "pkm_0002"],
        createdByEventId: "evt_0001",
      },
      {
        id: "link_0002",
        pokemonIds: ["pkm_0003", "pkm_0004"],
        createdByEventId: "evt_0007",
      },
    ],
    rules: [],
    tags: [
      {
        id: "clutch",
        label: "Clutch",
        style: "celebration",
      },
    ],
    events: [
      {
        id: "evt_0001",
        episodeId: "ep_0001",
        sequence: 1,
        type: "encounter",
        tone: "positive",
        importance: "major",
        locationId: "route-32",
        opportunityId: "route-32-main",
        acquisitionType: "wild",
        soulLinkId: "link_0001",
        videoTimestampSeconds: 120,
        outcomes: [
          {
            result: "caught",
            playerId: "player_fruit",
            pokemonId: "pkm_0001",
            speciesId: 179,
            nickname: "Luc",
            level: 6,
            placement: "party",
          },
          {
            result: "caught",
            playerId: "player_two",
            pokemonId: "pkm_0002",
            speciesId: 92,
            nickname: "Spooky",
            level: 5,
            placement: "party",
          },
        ],
      },
      {
        id: "evt_0002",
        episodeId: "ep_0001",
        sequence: 2,
        type: "evolution",
        tone: "positive",
        importance: "normal",
        pokemonId: "pkm_0001",
        fromSpeciesId: 179,
        toSpeciesId: 180,
        level: 15,
      },
      {
        id: "evt_0003",
        episodeId: "ep_0001",
        sequence: 3,
        type: "special-moment",
        tone: "positive",
        importance: "major",
        title: "The one HP dream",
        description: "Luc survives on one HP.",
        pokemonIds: ["pkm_0001"],
        tags: [{ tagId: "clutch" }],
      },
      {
        id: "evt_0004",
        episodeId: "ep_0002",
        sequence: 1,
        type: "gym-battle",
        tone: "positive",
        importance: "major",
        gymId: "violet-gym",
        leaderName: "Falkner",
        result: "win",
        participantPokemonIds: ["pkm_0001", "pkm_0002"],
        badgeId: "zephyr",
      },
      {
        id: "evt_0005",
        episodeId: "ep_0002",
        sequence: 2,
        type: "pokemon-death",
        tone: "negative",
        importance: "major",
        pokemonId: "pkm_0002",
        cause: "Fainted to a critical hit.",
      },
      {
        id: "evt_0006",
        episodeId: "ep_0002",
        sequence: 3,
        type: "special-moment",
        tone: "negative",
        importance: "normal",
        title: "A costly victory",
        description: "The first Soul Link is lost.",
        soulLinkIds: ["link_0001"],
      },
      {
        id: "evt_0007",
        episodeId: "ep_0003",
        sequence: 1,
        type: "encounter",
        tone: "positive",
        importance: "normal",
        locationId: "route-33",
        opportunityId: "route-33-main",
        acquisitionType: "wild",
        soulLinkId: "link_0002",
        outcomes: [
          {
            result: "caught",
            playerId: "player_fruit",
            pokemonId: "pkm_0003",
            speciesId: 155,
          },
          {
            result: "caught",
            playerId: "player_two",
            pokemonId: "pkm_0004",
            speciesId: 158,
          },
        ],
      },
    ],
  });
}

describe("Step 3 run state engine", () => {
  it("reconstructs Pokémon state through chronological events", () => {
    const dataset = makeDataset();
    const state = reconstructRun(dataset, { cutoff: { kind: "episode", episodeNumber: 1 } });
    const luc = state.pokemon.get("pkm_0001");

    expect(luc?.currentSpeciesId).toBe(180);
    expect(luc?.currentNickname).toBe("Luc");
    expect(luc?.currentLevel).toBe(15);
    expect(luc?.lifeStatus).toBe("alive");
    expect(luc?.placement).toBe("party");
  });

  it("distinguishes the actual death from the Soul Link retirement", () => {
    const dataset = makeDataset();
    const state = reconstructRun(dataset, { cutoff: { kind: "episode", episodeNumber: 2 } });

    expect(state.pokemon.get("pkm_0002")?.lifeStatus).toBe("dead");
    expect(state.pokemon.get("pkm_0001")?.lifeStatus).toBe("retired-by-link");
    expect(state.pokemon.get("pkm_0001")?.retirement?.triggeredByPokemonId).toBe("pkm_0002");
    expect(state.soulLinks.get("link_0001")?.status).toBe("lost");
    expect(state.soulLinks.get("link_0001")?.ended?.triggeredByPokemonId).toBe("pkm_0002");
  });

  it("keeps future Pokémon completely out of spoiler-limited state", () => {
    const dataset = makeDataset();
    const state = reconstructRun(dataset, { cutoff: { kind: "episode", episodeNumber: 2 } });

    expect(state.pokemon.has("pkm_0003")).toBe(false);
    expect(state.soulLinks.has("link_0002")).toBe(false);
  });

  it("can exclude draft episodes from reconstructed public state", () => {
    const dataset = makeDataset();
    const state = reconstructRun(dataset, { episodeStatus: "published" });

    expect(state.pokemon.has("pkm_0003")).toBe(false);
    expect(state.processedEventIds.at(-1)).toBe("evt_0006");
  });

  it("can stop at an exact event for the future history player", () => {
    const dataset = makeDataset();
    const state = reconstructRun(dataset, { cutoff: { kind: "event", eventId: "evt_0004" } });

    expect(state.earnedBadgeIds.has("zephyr")).toBe(true);
    expect(state.pokemon.get("pkm_0002")?.lifeStatus).toBe("alive");
  });

  it("builds Pokémon and Soul Link histories from the same event stream", () => {
    const dataset = makeDataset();
    const state = reconstructRun(dataset, { cutoff: { kind: "episode", episodeNumber: 2 } });

    expect(selectPokemonHistory(dataset, state, "pkm_0001").map((event) => event.id)).toEqual([
      "evt_0001",
      "evt_0002",
      "evt_0003",
      "evt_0004",
      "evt_0005",
    ]);
    expect(selectSoulLinkHistory(dataset, state, "link_0001").map((event) => event.id)).toEqual([
      "evt_0001",
      "evt_0002",
      "evt_0003",
      "evt_0004",
      "evt_0005",
      "evt_0006",
    ]);
  });

  it("selects major and special-moment highlights in chronological order", () => {
    const dataset = makeDataset();
    const state = reconstructRun(dataset, { cutoff: { kind: "episode", episodeNumber: 1 } });

    expect(selectHighlights(dataset, state).map((event) => event.id)).toEqual([
      "evt_0001",
      "evt_0003",
    ]);
  });

  it("reports a valid authored history as semantically valid", () => {
    const result = validateRunDatasetSemantics(makeDataset());
    expect(result.errors).toEqual([]);
  });

  it("catches an evolution whose from-species does not match history", () => {
    const dataset = makeDataset();
    const badDataset: RunDataset = {
      ...dataset,
      events: dataset.events.map((event) =>
        event.id === "evt_0002" && event.type === "evolution"
          ? { ...event, fromSpeciesId: 25 }
          : event,
      ),
    };

    const result = validateRunDatasetSemantics(badDataset);
    expect(result.errors.some((issue) => issue.code === "evolution-source-mismatch")).toBe(true);
  });
});

describe("Step 3 spoiler and timeline selectors", () => {
  it("hides the latest published episode by default policy", async () => {
    const { resolveSpoilerState } = await import("../src/index");
    const dataset = makeDataset();
    const spoiler = resolveSpoilerState(dataset.episodes, { mode: "hide-latest" });

    expect(spoiler.latestPublishedEpisodeNumber).toBe(2);
    expect(spoiler.visibleThroughEpisodeNumber).toBe(1);
  });

  it("clamps a manual spoiler episode to published content", async () => {
    const { resolveSpoilerState } = await import("../src/index");
    const dataset = makeDataset();
    const spoiler = resolveSpoilerState(dataset.episodes, {
      mode: "episode",
      episodeNumber: 99,
    });

    expect(spoiler.visibleThroughEpisodeNumber).toBe(2);
  });

  it("supports newest-first and chronological timeline grouping", async () => {
    const { selectTimelineEpisodeGroups } = await import("../src/index");
    const dataset = makeDataset();
    const state = reconstructRun(dataset, { cutoff: { kind: "episode", episodeNumber: 2 } });

    expect(
      selectTimelineEpisodeGroups(dataset, state, "newest-first").map(
        (group) => group.episode.number,
      ),
    ).toEqual([2, 1]);
    expect(
      selectTimelineEpisodeGroups(dataset, state, "chronological").map(
        (group) => group.episode.number,
      ),
    ).toEqual([1, 2]);
  });
});
