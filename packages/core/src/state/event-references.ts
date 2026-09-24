import type { EventId, PokemonId, RuleId, SoulLinkId, TagId } from "../schemas/identifiers.ts";
import type { RunEvent } from "../schemas/events.ts";

export interface EventReferences {
  pokemonIds: PokemonId[];
  soulLinkIds: SoulLinkId[];
  ruleIds: RuleId[];
  tagIds: TagId[];
  eventIds: EventId[];
}

export function getEventReferences(event: RunEvent): EventReferences {
  const pokemonIds: PokemonId[] = [];
  const soulLinkIds: SoulLinkId[] = [];
  const ruleIds: RuleId[] = [];
  const eventIds: EventId[] = [...(event.relatedEventIds ?? [])];

  switch (event.type) {
    case "encounter":
      for (const outcome of event.outcomes) {
        if (outcome.result === "caught") pokemonIds.push(outcome.pokemonId);
      }
      if (event.soulLinkId !== undefined) soulLinkIds.push(event.soulLinkId);
      break;
    case "nickname-changed":
    case "evolution":
    case "level-milestone":
    case "move-changed":
    case "held-item-changed":
    case "ability-changed":
    case "form-changed":
    case "pokemon-death":
    case "pokemon-revived":
      pokemonIds.push(event.pokemonId);
      break;
    case "party-changed":
      pokemonIds.push(...event.pokemonIds);
      break;
    case "gym-battle":
    case "major-battle":
      pokemonIds.push(...event.participantPokemonIds);
      break;
    case "special-moment":
      pokemonIds.push(...(event.pokemonIds ?? []));
      soulLinkIds.push(...(event.soulLinkIds ?? []));
      break;
    case "rule-ruling":
      ruleIds.push(event.ruleId);
      eventIds.push(...(event.affectedEventIds ?? []));
      break;
    case "custom":
      pokemonIds.push(...(event.pokemonIds ?? []));
      soulLinkIds.push(...(event.soulLinkIds ?? []));
      break;
    case "progression-changed":
      break;
  }

  for (const annotation of event.annotations ?? []) {
    if (annotation.ruleId !== undefined) ruleIds.push(annotation.ruleId);
  }

  return {
    pokemonIds: unique(pokemonIds),
    soulLinkIds: unique(soulLinkIds),
    ruleIds: unique(ruleIds),
    tagIds: unique((event.tags ?? []).map((tag) => tag.tagId)),
    eventIds: unique(eventIds),
  };
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
