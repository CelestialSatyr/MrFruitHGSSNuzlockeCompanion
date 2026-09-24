import type { RunDataset } from "../schemas/dataset.ts";
import type { RunEvent } from "../schemas/events.ts";
import type { EventId } from "../schemas/identifiers.ts";
import { getEventReferences } from "../state/event-references.ts";
import { getOrderedRunEvents } from "../state/order.ts";
import {
  applyRunEvent,
  createInitialMutableRunState,
  createRunStateBuildContext,
} from "../state/reducer.ts";
import type { GameStateAdapter, MutableRunState } from "../state/types.ts";

export type ValidationSeverity = "error" | "warning";

export interface SemanticValidationIssue {
  severity: ValidationSeverity;
  code: string;
  message: string;
  entityId?: string;
  eventId?: EventId;
}

export interface SemanticValidationResult {
  valid: boolean;
  issues: SemanticValidationIssue[];
  errors: SemanticValidationIssue[];
  warnings: SemanticValidationIssue[];
}

export function validateRunDatasetSemantics<TGameState = undefined>(
  dataset: RunDataset,
  gameAdapter?: GameStateAdapter<TGameState>,
): SemanticValidationResult {
  const issues: SemanticValidationIssue[] = [];

  validateUniqueAndRootReferences(dataset, issues);
  validateStaticReferences(dataset, issues, gameAdapter);
  validateCreationRelationships(dataset, issues);
  validateChronology(dataset, issues, gameAdapter);

  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");
  return { valid: errors.length === 0, issues, errors, warnings };
}

export function assertRunDatasetSemantics<TGameState = undefined>(
  dataset: RunDataset,
  gameAdapter?: GameStateAdapter<TGameState>,
): void {
  const result = validateRunDatasetSemantics(dataset, gameAdapter);
  if (result.valid) return;

  const details = result.errors.map((issue) => `${issue.code}: ${issue.message}`).join("\n");
  throw new Error(`Run dataset failed semantic validation:\n${details}`);
}

function validateUniqueAndRootReferences(
  dataset: RunDataset,
  issues: SemanticValidationIssue[],
): void {
  validateUnique(dataset.players, "player", issues);
  validateUnique(dataset.episodes, "episode", issues);
  validateUnique(dataset.pokemon, "pokemon", issues);
  validateUnique(dataset.soulLinks, "soul-link", issues);
  validateUnique(dataset.rules, "rule", issues);
  validateUnique(dataset.tags, "tag", issues);
  validateUnique(dataset.events, "event", issues);

  const episodeNumbers = new Set<number>();
  for (const episode of dataset.episodes) {
    if (episodeNumbers.has(episode.number)) {
      issues.push(
        error(
          "duplicate-episode-number",
          `Episode number ${episode.number} is duplicated.`,
          episode.id,
        ),
      );
    }
    episodeNumbers.add(episode.number);
  }

  const playerIds = new Set(dataset.players.map((player) => player.id));
  for (const playerId of dataset.run.playerIds) {
    if (!playerIds.has(playerId)) {
      issues.push(
        error("missing-run-player", `Run references missing player ${playerId}.`, playerId),
      );
    }
  }
  for (const player of dataset.players) {
    if (!dataset.run.playerIds.includes(player.id)) {
      issues.push(
        warning(
          "unreferenced-player",
          `Player ${player.id} exists but is not included in run.playerIds.`,
          player.id,
        ),
      );
    }
  }

  const sequenceKeys = new Set<string>();
  for (const event of dataset.events) {
    const key = `${event.episodeId}:${event.sequence}`;
    if (sequenceKeys.has(key)) {
      issues.push(
        error(
          "duplicate-event-sequence",
          `Episode ${event.episodeId} contains more than one event at sequence ${event.sequence}.`,
          event.id,
          event.id,
        ),
      );
    }
    sequenceKeys.add(key);
  }
}

function validateStaticReferences<TGameState>(
  dataset: RunDataset,
  issues: SemanticValidationIssue[],
  gameAdapter?: GameStateAdapter<TGameState>,
): void {
  if (gameAdapter !== undefined && dataset.run.gameId !== gameAdapter.gameId) {
    issues.push(
      error(
        "game-adapter-mismatch",
        `Run game ${dataset.run.gameId} cannot be validated with adapter ${gameAdapter.gameId}.`,
        dataset.run.id,
      ),
    );
  }

  const players = new Map(dataset.players.map((value) => [value.id, value]));
  const episodes = new Map(dataset.episodes.map((value) => [value.id, value]));
  const pokemon = new Map(dataset.pokemon.map((value) => [value.id, value]));
  const links = new Map(dataset.soulLinks.map((value) => [value.id, value]));
  const rules = new Map(dataset.rules.map((value) => [value.id, value]));
  const tags = new Map(dataset.tags.map((value) => [value.id, value]));
  const events = new Map(dataset.events.map((value) => [value.id, value]));

  for (const mon of dataset.pokemon) {
    if (!players.has(mon.playerId)) {
      issues.push(
        error(
          "missing-pokemon-player",
          `${mon.id} references missing player ${mon.playerId}.`,
          mon.id,
        ),
      );
    }
    if (!events.has(mon.createdByEventId)) {
      issues.push(
        error(
          "missing-pokemon-creation-event",
          `${mon.id} references missing creation event ${mon.createdByEventId}.`,
          mon.id,
        ),
      );
    }
  }

  const linkedPokemon = new Map<string, string>();
  for (const link of dataset.soulLinks) {
    if (!events.has(link.createdByEventId)) {
      issues.push(
        error(
          "missing-link-creation-event",
          `${link.id} references missing creation event ${link.createdByEventId}.`,
          link.id,
        ),
      );
    }

    const [leftId, rightId] = link.pokemonIds;
    const left = pokemon.get(leftId);
    const right = pokemon.get(rightId);
    if (left === undefined)
      issues.push(
        error("missing-link-pokemon", `${link.id} references missing Pokémon ${leftId}.`, link.id),
      );
    if (right === undefined)
      issues.push(
        error("missing-link-pokemon", `${link.id} references missing Pokémon ${rightId}.`, link.id),
      );
    if (left !== undefined && right !== undefined && left.playerId === right.playerId) {
      issues.push(
        error(
          "same-owner-soul-link",
          `${link.id} connects two Pokémon owned by ${left.playerId}.`,
          link.id,
        ),
      );
    }

    for (const pokemonId of link.pokemonIds) {
      const existing = linkedPokemon.get(pokemonId);
      if (existing !== undefined) {
        issues.push(
          error(
            "pokemon-in-multiple-links",
            `${pokemonId} is assigned to both ${existing} and ${link.id}.`,
            pokemonId,
          ),
        );
      } else {
        linkedPokemon.set(pokemonId, link.id);
      }
    }
  }

  for (const event of dataset.events) {
    if (!episodes.has(event.episodeId)) {
      issues.push(
        error(
          "missing-event-episode",
          `${event.id} references missing episode ${event.episodeId}.`,
          event.id,
          event.id,
        ),
      );
    }

    const references = getEventReferences(event);
    for (const pokemonId of references.pokemonIds) {
      if (!pokemon.has(pokemonId)) {
        issues.push(
          error(
            "missing-event-pokemon",
            `${event.id} references missing Pokémon ${pokemonId}.`,
            event.id,
            event.id,
          ),
        );
      }
    }
    for (const linkId of references.soulLinkIds) {
      if (!links.has(linkId)) {
        issues.push(
          error(
            "missing-event-link",
            `${event.id} references missing Soul Link ${linkId}.`,
            event.id,
            event.id,
          ),
        );
      }
    }
    for (const ruleId of references.ruleIds) {
      if (!rules.has(ruleId)) {
        issues.push(
          error(
            "missing-event-rule",
            `${event.id} references missing rule ${ruleId}.`,
            event.id,
            event.id,
          ),
        );
      }
    }
    for (const tagId of references.tagIds) {
      if (!tags.has(tagId)) {
        issues.push(
          error(
            "missing-event-tag",
            `${event.id} references missing tag ${tagId}.`,
            event.id,
            event.id,
          ),
        );
      }
    }
    for (const relatedEventId of references.eventIds) {
      if (!events.has(relatedEventId)) {
        issues.push(
          error(
            "missing-related-event",
            `${event.id} references missing event ${relatedEventId}.`,
            event.id,
            event.id,
          ),
        );
      }
    }

    if (event.type === "encounter") {
      for (const outcome of event.outcomes) {
        if (!players.has(outcome.playerId)) {
          issues.push(
            error(
              "missing-encounter-player",
              `${event.id} references missing player ${outcome.playerId}.`,
              event.id,
              event.id,
            ),
          );
        }
        if (outcome.result === "caught") {
          const authored = pokemon.get(outcome.pokemonId);
          if (authored !== undefined && authored.playerId !== outcome.playerId) {
            issues.push(
              error(
                "encounter-owner-mismatch",
                `${outcome.pokemonId} belongs to ${authored.playerId}, not ${outcome.playerId}.`,
                event.id,
                event.id,
              ),
            );
          }
          if (authored !== undefined && authored.initialSpeciesId !== outcome.speciesId) {
            issues.push(
              error(
                "initial-species-mismatch",
                `${outcome.pokemonId} is authored with species ${authored.initialSpeciesId}, but its encounter uses ${outcome.speciesId}.`,
                event.id,
                event.id,
              ),
            );
          }
        }
      }
    }

    if (
      event.type === "gym-battle" &&
      event.badgeId !== undefined &&
      gameAdapter?.validateProgressionFlag !== undefined &&
      !gameAdapter.validateProgressionFlag({ kind: "badge", id: event.badgeId })
    ) {
      issues.push(
        error(
          "unknown-badge-id",
          `${event.id} references unknown badge ${event.badgeId}.`,
          event.id,
          event.id,
        ),
      );
    }

    if (
      event.type === "progression-changed" &&
      gameAdapter?.validateProgressionFlag !== undefined
    ) {
      if (!gameAdapter.validateProgressionFlag(event.flag)) {
        issues.push(
          error(
            "unknown-progression-flag",
            `${event.id} references unknown ${event.flag.kind} flag ${event.flag.id}.`,
            event.id,
            event.id,
          ),
        );
      }
    }
  }
}

function validateCreationRelationships(
  dataset: RunDataset,
  issues: SemanticValidationIssue[],
): void {
  const events = new Map(dataset.events.map((event) => [event.id, event]));

  for (const mon of dataset.pokemon) {
    const creationEvent = events.get(mon.createdByEventId);
    if (creationEvent === undefined) continue;
    if (creationEvent.type !== "encounter") {
      issues.push(
        error(
          "invalid-pokemon-creation-event",
          `${mon.id} must be created by an encounter event, not ${creationEvent.type}.`,
          mon.id,
        ),
      );
      continue;
    }
    const createsPokemon = creationEvent.outcomes.some(
      (outcome) => outcome.result === "caught" && outcome.pokemonId === mon.id,
    );
    if (!createsPokemon) {
      issues.push(
        error(
          "creation-event-does-not-create-pokemon",
          `${mon.createdByEventId} does not contain caught outcome for ${mon.id}.`,
          mon.id,
        ),
      );
    }
  }

  for (const link of dataset.soulLinks) {
    const creationEvent = events.get(link.createdByEventId);
    if (creationEvent === undefined) continue;
    if (creationEvent.type !== "encounter" || creationEvent.soulLinkId !== link.id) {
      issues.push(
        error(
          "invalid-link-creation-event",
          `${link.id} must be created by an encounter that references the same Soul Link ID.`,
          link.id,
        ),
      );
      continue;
    }
    const caughtIds = creationEvent.outcomes
      .filter((outcome) => outcome.result === "caught")
      .map((outcome) => outcome.pokemonId)
      .sort();
    const linkedIds = [...link.pokemonIds].sort();
    if (caughtIds.join("|") !== linkedIds.join("|")) {
      issues.push(
        error(
          "link-members-do-not-match-encounter",
          `${link.id} members do not match the Pokémon caught by ${creationEvent.id}.`,
          link.id,
        ),
      );
    }
  }
}

function validateChronology<TGameState>(
  dataset: RunDataset,
  issues: SemanticValidationIssue[],
  gameAdapter?: GameStateAdapter<TGameState>,
): void {
  const context = createRunStateBuildContext(dataset, gameAdapter);
  const state = createInitialMutableRunState(gameAdapter);
  const encounterKeys = new Set<string>();

  for (const { event, episode } of getOrderedRunEvents(dataset)) {
    validateEventAgainstState(event, state, issues);

    if (event.type === "encounter") {
      const key = `${event.locationId}::${event.opportunityId}`;
      if (encounterKeys.has(key)) {
        issues.push(
          warning(
            "encounter-opportunity-reused",
            `${event.locationId} / ${event.opportunityId} has more than one encounter event. Confirm this is intentional under the run rules.`,
            event.id,
            event.id,
          ),
        );
      }
      encounterKeys.add(key);
    }

    applyRunEvent(state, event, episode.number, context);
  }
}

function validateEventAgainstState<TGameState>(
  event: RunEvent,
  state: MutableRunState<TGameState | undefined>,
  issues: SemanticValidationIssue[],
): void {
  const references = getEventReferences(event);
  if (event.type !== "encounter") {
    for (const pokemonId of references.pokemonIds) {
      if (!state.pokemon.has(pokemonId)) {
        issues.push(
          error(
            "pokemon-used-before-capture",
            `${event.id} references ${pokemonId} before its capture event.`,
            event.id,
            event.id,
          ),
        );
      }
    }
  }

  switch (event.type) {
    case "encounter":
      for (const outcome of event.outcomes) {
        if (outcome.result === "caught" && state.pokemon.has(outcome.pokemonId)) {
          issues.push(
            error(
              "pokemon-created-twice",
              `${outcome.pokemonId} is caught more than once.`,
              event.id,
              event.id,
            ),
          );
        }
      }
      if (event.soulLinkId !== undefined && state.soulLinks.has(event.soulLinkId)) {
        issues.push(
          error(
            "link-created-twice",
            `${event.soulLinkId} is created more than once.`,
            event.id,
            event.id,
          ),
        );
      }
      break;
    case "evolution": {
      const pokemon = state.pokemon.get(event.pokemonId);
      if (pokemon !== undefined && pokemon.currentSpeciesId !== event.fromSpeciesId) {
        issues.push(
          error(
            "evolution-source-mismatch",
            `${event.pokemonId} is species ${pokemon.currentSpeciesId} before ${event.id}, not ${event.fromSpeciesId}.`,
            event.id,
            event.id,
          ),
        );
      }
      validatePokemonCanAct(event, event.pokemonId, state, issues);
      break;
    }
    case "nickname-changed": {
      const pokemon = state.pokemon.get(event.pokemonId);
      if (
        pokemon !== undefined &&
        event.fromNickname !== undefined &&
        pokemon.currentNickname !== event.fromNickname
      ) {
        issues.push(
          warning(
            "nickname-source-mismatch",
            `${event.pokemonId} nickname before ${event.id} does not match fromNickname.`,
            event.id,
            event.id,
          ),
        );
      }
      break;
    }
    case "pokemon-death": {
      const pokemon = state.pokemon.get(event.pokemonId);
      if (pokemon !== undefined && pokemon.lifeStatus !== "alive") {
        issues.push(
          error(
            "inactive-pokemon-death",
            `${event.pokemonId} cannot die while its status is ${pokemon.lifeStatus}.`,
            event.id,
            event.id,
          ),
        );
      }
      break;
    }
    case "pokemon-revived": {
      const pokemon = state.pokemon.get(event.pokemonId);
      if (pokemon !== undefined && pokemon.lifeStatus === "alive") {
        issues.push(
          error(
            "living-pokemon-revived",
            `${event.pokemonId} is already alive before ${event.id}.`,
            event.id,
            event.id,
          ),
        );
      }
      break;
    }
    case "party-changed":
      if (event.to !== "retired") {
        for (const pokemonId of event.pokemonIds)
          validatePokemonCanAct(event, pokemonId, state, issues);
      }
      break;
    case "level-milestone":
    case "move-changed":
    case "held-item-changed":
    case "ability-changed":
    case "form-changed":
      validatePokemonCanAct(event, event.pokemonId, state, issues);
      break;
    case "gym-battle":
    case "major-battle":
      for (const pokemonId of event.participantPokemonIds)
        validatePokemonCanAct(event, pokemonId, state, issues);
      break;
    case "progression-changed":
    case "special-moment":
    case "rule-ruling":
    case "custom":
      break;
  }
}

function validatePokemonCanAct<TGameState>(
  event: RunEvent,
  pokemonId: string,
  state: MutableRunState<TGameState | undefined>,
  issues: SemanticValidationIssue[],
): void {
  const pokemon = state.pokemon.get(pokemonId);
  if (pokemon !== undefined && pokemon.lifeStatus !== "alive") {
    issues.push(
      error(
        "inactive-pokemon-event",
        `${pokemonId} is ${pokemon.lifeStatus} before ${event.id} and cannot participate in ${event.type}.`,
        event.id,
        event.id,
      ),
    );
  }
}

function validateUnique(
  values: readonly { id: string }[],
  label: string,
  issues: SemanticValidationIssue[],
): void {
  const ids = new Set<string>();
  for (const value of values) {
    if (ids.has(value.id)) {
      issues.push(error(`duplicate-${label}-id`, `Duplicate ${label} ID ${value.id}.`, value.id));
    }
    ids.add(value.id);
  }
}

function error(
  code: string,
  message: string,
  entityId?: string,
  eventId?: EventId,
): SemanticValidationIssue {
  return withOptionalFields("error", code, message, entityId, eventId);
}

function warning(
  code: string,
  message: string,
  entityId?: string,
  eventId?: EventId,
): SemanticValidationIssue {
  return withOptionalFields("warning", code, message, entityId, eventId);
}

function withOptionalFields(
  severity: ValidationSeverity,
  code: string,
  message: string,
  entityId?: string,
  eventId?: EventId,
): SemanticValidationIssue {
  const issue: SemanticValidationIssue = { severity, code, message };
  if (entityId !== undefined) issue.entityId = entityId;
  if (eventId !== undefined) issue.eventId = eventId;
  return issue;
}
