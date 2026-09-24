import { z } from "zod";

const opaqueId = (prefix: string) =>
  z
    .string()
    .regex(
      new RegExp(`^${prefix}_[0-9]{4,}$`),
      `Expected ${prefix}_ followed by at least four digits`,
    );

const semanticId = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Expected a lowercase kebab-case identifier");

export const RunIdSchema = semanticId;
export const PlayerIdSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^player_[a-z0-9]+(?:_[a-z0-9]+)*$/, "Expected a player_ identifier");

export const EpisodeIdSchema = opaqueId("ep");
export const PokemonIdSchema = opaqueId("pkm");
export const SoulLinkIdSchema = opaqueId("link");
export const EventIdSchema = opaqueId("evt");

export const RuleIdSchema = semanticId;
export const TagIdSchema = semanticId;
export const GameIdSchema = semanticId;
export const LocationIdSchema = semanticId;
export const EncounterOpportunityIdSchema = semanticId;
export const GymIdSchema = semanticId;
export const BadgeIdSchema = semanticId;

export type RunId = z.infer<typeof RunIdSchema>;
export type PlayerId = z.infer<typeof PlayerIdSchema>;
export type EpisodeId = z.infer<typeof EpisodeIdSchema>;
export type PokemonId = z.infer<typeof PokemonIdSchema>;
export type SoulLinkId = z.infer<typeof SoulLinkIdSchema>;
export type EventId = z.infer<typeof EventIdSchema>;
export type RuleId = z.infer<typeof RuleIdSchema>;
export type TagId = z.infer<typeof TagIdSchema>;
export type GameId = z.infer<typeof GameIdSchema>;
export type LocationId = z.infer<typeof LocationIdSchema>;
export type EncounterOpportunityId = z.infer<typeof EncounterOpportunityIdSchema>;
