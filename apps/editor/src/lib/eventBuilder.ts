import {
  RunEventSchema,
  parseRunDataset,
  type EventTone,
  type EventImportance,
  type EventAnnotation,
  type RunDataset,
  type RunEvent,
} from "@nuzlocke/core";
import { reconstructHgssRun } from "@nuzlocke/hgss";
import { nextOpaqueId, parseTimestampInput } from "./editorData";

export interface EventIdPools {
  eventIds: readonly string[];
  pokemonIds: readonly string[];
  soulLinkIds: readonly string[];
}

export interface EventDraftInput {
  episodeId: string;
  sequence: number;
  type: RunEvent["type"];
  timestamp: string;
  tone: EventTone;
  importance: EventImportance;
  title: string;
  description: string;
  tagIds: string[];
  annotations: Array<{ kind: EventAnnotation["kind"]; text: string; ruleId: string }>;
  pokemonIds: string[];
  soulLinkIds: string[];
  pokemonId: string;
  locationId: string;
  opportunityId: string;
  acquisitionType: "wild" | "starter" | "gift" | "static" | "trade" | "other";
  left: EncounterSideInput;
  right: EncounterSideInput;
  fromSpeciesId: string;
  toSpeciesId: string;
  level: string;
  nickname: string;
  previousValue: string;
  nextValue: string;
  learnedMoveId: string;
  forgottenMoveId: string;
  destination: "party" | "box" | "retired";
  reason: string;
  cause: string;
  opponentName: string;
  gymId: string;
  leaderName: string;
  result: string;
  badgeId: string;
  progressionKind: "badge" | "capability" | "milestone";
  progressionId: string;
  progressionValue: boolean;
  ruleId: string;
  ruling: "violation" | "dispute" | "exception" | "clarification";
}

export interface EncounterSideInput {
  result: "caught" | "failed" | "skipped";
  speciesId: string;
  nickname: string;
  level: string;
  placement: "party" | "box";
  gender: "male" | "female" | "genderless" | "unknown";
  shiny: boolean;
  natureId: string;
  abilityId: string;
  reason: string;
}

function optionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function numberOrUndefined(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function baseEvent(input: EventDraftInput, eventId: string) {
  const timestamp = parseTimestampInput(input.timestamp);
  return {
    id: eventId,
    episodeId: input.episodeId,
    sequence: input.sequence,
    ...(timestamp !== undefined ? { videoTimestampSeconds: timestamp } : {}),
    tone: input.tone,
    importance: input.importance,
    ...(optionalText(input.title) ? { title: optionalText(input.title) } : {}),
    ...(optionalText(input.description) ? { description: optionalText(input.description) } : {}),
    ...(input.tagIds.length ? { tags: input.tagIds.map((tagId) => ({ tagId })) } : {}),
    ...(input.annotations.length
      ? {
          annotations: input.annotations
            .map((annotation) => ({
              kind: annotation.kind,
              text: annotation.text.trim(),
              ...(annotation.ruleId.trim() ? { ruleId: annotation.ruleId.trim() } : {}),
            }))
            .filter((annotation) => annotation.text.length > 0),
        }
      : {}),
  };
}

function buildEncounterOutcome(
  side: EncounterSideInput,
  playerId: string,
  pokemonId: string | undefined,
): unknown {
  const speciesId = numberOrUndefined(side.speciesId);
  if (side.result === "caught") {
    if (!pokemonId || !speciesId) throw new Error("Caught encounters require a valid species ID.");
    return {
      result: "caught",
      playerId,
      pokemonId,
      speciesId,
      ...(numberOrUndefined(side.level) !== undefined
        ? { level: numberOrUndefined(side.level) }
        : {}),
      ...(optionalText(side.nickname) ? { nickname: optionalText(side.nickname) } : {}),
      placement: side.placement,
    };
  }

  return {
    result: side.result,
    playerId,
    ...(speciesId !== undefined ? { speciesId } : {}),
    ...(optionalText(side.reason) ? { reason: optionalText(side.reason) } : {}),
  };
}

function upsertEventInDataset(
  dataset: RunDataset,
  input: EventDraftInput,
  existingEventId?: string,
  idPools?: EventIdPools,
): RunDataset {
  if (!dataset.episodes.some((episode) => episode.id === input.episodeId)) {
    throw new Error("Choose a valid episode before adding the event.");
  }

  const eventId =
    existingEventId ??
    nextOpaqueId("evt", idPools?.eventIds ?? dataset.events.map((event) => event.id));
  const previousEvent = existingEventId
    ? dataset.events.find((event) => event.id === existingEventId)
    : undefined;
  const previousEncounter = previousEvent?.type === "encounter" ? previousEvent : undefined;
  const previousPokemonByPlayer = new Map<string, string>();
  if (previousEncounter) {
    for (const outcome of previousEncounter.outcomes) {
      if (outcome.result === "caught")
        previousPokemonByPlayer.set(outcome.playerId, outcome.pokemonId);
    }
  }
  const base = baseEvent(input, eventId);
  const pokemon = dataset.pokemon.filter((entry) => entry.createdByEventId !== eventId);
  const soulLinks = dataset.soulLinks.filter((entry) => entry.createdByEventId !== eventId);
  let rawEvent: unknown;

  switch (input.type) {
    case "encounter": {
      const [leftPlayerId, rightPlayerId] = dataset.run.playerIds;
      if (!leftPlayerId || !rightPlayerId) throw new Error("A Soul Link run requires two players.");

      const leftPokemonId =
        input.left.result === "caught"
          ? (previousPokemonByPlayer.get(leftPlayerId) ??
            nextOpaqueId("pkm", idPools?.pokemonIds ?? dataset.pokemon.map((entry) => entry.id)))
          : undefined;
      if (leftPokemonId) {
        const speciesId = numberOrUndefined(input.left.speciesId);
        if (!speciesId) throw new Error("Player one needs a valid species ID.");
        pokemon.push({
          id: leftPokemonId as never,
          playerId: leftPlayerId,
          createdByEventId: eventId as never,
          initialSpeciesId: speciesId,
          gender: input.left.gender,
          shiny: input.left.shiny,
          ...(optionalText(input.left.natureId)
            ? { natureId: optionalText(input.left.natureId) }
            : {}),
          ...(optionalText(input.left.abilityId)
            ? { initialAbilityId: optionalText(input.left.abilityId) }
            : {}),
        });
      }

      const rightPokemonId =
        input.right.result === "caught"
          ? (previousPokemonByPlayer.get(rightPlayerId) ??
            nextOpaqueId("pkm", [
              ...(idPools?.pokemonIds ?? dataset.pokemon.map((entry) => entry.id)),
              ...(leftPokemonId ? [leftPokemonId] : []),
            ]))
          : undefined;
      if (rightPokemonId) {
        const speciesId = numberOrUndefined(input.right.speciesId);
        if (!speciesId) throw new Error("Player two needs a valid species ID.");
        pokemon.push({
          id: rightPokemonId as never,
          playerId: rightPlayerId,
          createdByEventId: eventId as never,
          initialSpeciesId: speciesId,
          gender: input.right.gender,
          shiny: input.right.shiny,
          ...(optionalText(input.right.natureId)
            ? { natureId: optionalText(input.right.natureId) }
            : {}),
          ...(optionalText(input.right.abilityId)
            ? { initialAbilityId: optionalText(input.right.abilityId) }
            : {}),
        });
      }

      const bothCaught = Boolean(leftPokemonId && rightPokemonId);
      const linkId = bothCaught
        ? (previousEncounter?.soulLinkId ??
          nextOpaqueId("link", idPools?.soulLinkIds ?? dataset.soulLinks.map((entry) => entry.id)))
        : undefined;
      if (linkId && leftPokemonId && rightPokemonId) {
        soulLinks.push({
          id: linkId as never,
          pokemonIds: [leftPokemonId, rightPokemonId] as never,
          createdByEventId: eventId as never,
        });
      }

      rawEvent = {
        ...base,
        type: "encounter",
        locationId: input.locationId,
        opportunityId: input.opportunityId,
        acquisitionType: input.acquisitionType,
        outcomes: [
          buildEncounterOutcome(input.left, leftPlayerId, leftPokemonId),
          buildEncounterOutcome(input.right, rightPlayerId, rightPokemonId),
        ],
        ...(linkId ? { soulLinkId: linkId } : {}),
      };
      break;
    }
    case "evolution":
      rawEvent = {
        ...base,
        type: "evolution",
        pokemonId: input.pokemonId,
        fromSpeciesId: Number(input.fromSpeciesId),
        toSpeciesId: Number(input.toSpeciesId),
        ...(numberOrUndefined(input.level) !== undefined
          ? { level: numberOrUndefined(input.level) }
          : {}),
      };
      break;
    case "nickname-changed":
      rawEvent = {
        ...base,
        type: "nickname-changed",
        pokemonId: input.pokemonId,
        ...(optionalText(input.previousValue)
          ? { fromNickname: optionalText(input.previousValue) }
          : {}),
        toNickname: input.nickname.trim(),
      };
      break;
    case "party-changed":
      rawEvent = {
        ...base,
        type: "party-changed",
        pokemonIds: input.pokemonIds.length ? input.pokemonIds : [input.pokemonId],
        to: input.destination,
        ...(optionalText(input.reason) ? { reason: optionalText(input.reason) } : {}),
      };
      break;
    case "level-milestone":
      rawEvent = {
        ...base,
        type: "level-milestone",
        pokemonId: input.pokemonId,
        level: Number(input.level),
        ...(optionalText(input.title) ? { label: optionalText(input.title) } : {}),
      };
      break;
    case "move-changed":
      rawEvent = {
        ...base,
        type: "move-changed",
        pokemonId: input.pokemonId,
        ...(optionalText(input.learnedMoveId)
          ? { learnedMoveId: optionalText(input.learnedMoveId) }
          : {}),
        ...(optionalText(input.forgottenMoveId)
          ? { forgottenMoveId: optionalText(input.forgottenMoveId) }
          : {}),
      };
      break;
    case "held-item-changed":
      rawEvent = {
        ...base,
        type: "held-item-changed",
        pokemonId: input.pokemonId,
        ...(optionalText(input.previousValue)
          ? { fromItemId: optionalText(input.previousValue) }
          : {}),
        ...(optionalText(input.nextValue) ? { toItemId: optionalText(input.nextValue) } : {}),
      };
      break;
    case "ability-changed":
      rawEvent = {
        ...base,
        type: "ability-changed",
        pokemonId: input.pokemonId,
        ...(optionalText(input.previousValue)
          ? { fromAbilityId: optionalText(input.previousValue) }
          : {}),
        toAbilityId: input.nextValue.trim(),
      };
      break;
    case "form-changed":
      rawEvent = {
        ...base,
        type: "form-changed",
        pokemonId: input.pokemonId,
        ...(optionalText(input.previousValue)
          ? { fromFormId: optionalText(input.previousValue) }
          : {}),
        toFormId: input.nextValue.trim(),
      };
      break;
    case "gym-battle": {
      const state = reconstructHgssRun(dataset, { episodeStatus: "all" });
      const participants = input.pokemonIds.length
        ? input.pokemonIds
        : [...state.pokemon.values()]
            .filter((entry) => entry.lifeStatus === "alive" && entry.placement === "party")
            .map((entry) => entry.id);
      rawEvent = {
        ...base,
        type: "gym-battle",
        gymId: input.gymId,
        leaderName: input.leaderName.trim(),
        result: input.result === "loss" ? "loss" : "win",
        participantPokemonIds: participants,
        ...(input.result !== "loss" && input.badgeId ? { badgeId: input.badgeId } : {}),
      };
      break;
    }
    case "major-battle":
      rawEvent = {
        ...base,
        type: "major-battle",
        battleName: input.title.trim() || "Major battle",
        result: ["win", "loss", "draw", "escaped", "other"].includes(input.result)
          ? input.result
          : "other",
        participantPokemonIds: input.pokemonIds.length ? input.pokemonIds : [input.pokemonId],
      };
      break;
    case "pokemon-death":
      rawEvent = {
        ...base,
        type: "pokemon-death",
        pokemonId: input.pokemonId,
        ...(input.locationId ? { locationId: input.locationId } : {}),
        ...(optionalText(input.opponentName)
          ? { opponentName: optionalText(input.opponentName) }
          : {}),
        cause: input.cause.trim(),
      };
      break;
    case "pokemon-revived":
      rawEvent = {
        ...base,
        type: "pokemon-revived",
        pokemonId: input.pokemonId,
        reason: input.reason.trim(),
      };
      break;
    case "progression-changed":
      rawEvent = {
        ...base,
        type: "progression-changed",
        flag: {
          kind: input.progressionKind,
          id: input.progressionId,
          value: input.progressionValue,
        },
      };
      break;
    case "special-moment":
      rawEvent = {
        ...base,
        type: "special-moment",
        title: input.title.trim(),
        description: input.description.trim(),
        ...(input.pokemonIds.length ? { pokemonIds: input.pokemonIds } : {}),
        ...(input.soulLinkIds.length ? { soulLinkIds: input.soulLinkIds } : {}),
      };
      break;
    case "rule-ruling":
      rawEvent = {
        ...base,
        type: "rule-ruling",
        ruleId: input.ruleId,
        ruling: input.ruling,
        details: input.description.trim() || input.reason.trim(),
      };
      break;
    case "custom":
      rawEvent = {
        ...base,
        type: "custom",
        title: input.title.trim() || "Custom event",
        description: input.description.trim() || "Custom run event",
        ...(input.pokemonIds.length ? { pokemonIds: input.pokemonIds } : {}),
        ...(input.soulLinkIds.length ? { soulLinkIds: input.soulLinkIds } : {}),
        ...(input.locationId ? { locationId: input.locationId } : {}),
      };
      break;
  }

  const event = RunEventSchema.parse(rawEvent);
  return parseRunDataset({
    ...dataset,
    pokemon,
    soulLinks,
    events: existingEventId
      ? dataset.events.map((entry) => (entry.id === existingEventId ? event : entry))
      : [...dataset.events, event],
  });
}

export function addEventToDataset(
  dataset: RunDataset,
  input: EventDraftInput,
  idPools?: EventIdPools,
): RunDataset {
  return upsertEventInDataset(dataset, input, undefined, idPools);
}

export function updateEventInDataset(
  dataset: RunDataset,
  eventId: string,
  input: EventDraftInput,
  idPools?: EventIdPools,
): RunDataset {
  if (!dataset.events.some((event) => event.id === eventId))
    throw new Error(`Unknown event ${eventId}.`);
  return upsertEventInDataset(dataset, input, eventId, idPools);
}

export function deleteEventFromDataset(dataset: RunDataset, eventId: string): RunDataset {
  return parseRunDataset({
    ...dataset,
    events: dataset.events.filter((event) => event.id !== eventId),
    pokemon: dataset.pokemon.filter((entry) => entry.createdByEventId !== eventId),
    soulLinks: dataset.soulLinks.filter((entry) => entry.createdByEventId !== eventId),
  });
}
