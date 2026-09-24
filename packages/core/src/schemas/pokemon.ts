import { z } from "zod";
import { EventIdSchema, PlayerIdSchema, PokemonIdSchema } from "./identifiers.ts";
import { NonEmptyStringSchema, PokemonGenderSchema, PokemonSpeciesIdSchema } from "./common.ts";

export const PokemonSchema = z
  .object({
    id: PokemonIdSchema,
    playerId: PlayerIdSchema,
    createdByEventId: EventIdSchema,
    initialSpeciesId: PokemonSpeciesIdSchema,
    gender: PokemonGenderSchema.default("unknown"),
    shiny: z.boolean().default(false),
    natureId: NonEmptyStringSchema.optional(),
    initialAbilityId: NonEmptyStringSchema.optional(),
    initialFormId: NonEmptyStringSchema.optional(),
    notes: NonEmptyStringSchema.optional(),
  })
  .strict();

export type Pokemon = z.infer<typeof PokemonSchema>;
