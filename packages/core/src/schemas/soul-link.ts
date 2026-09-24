import { z } from "zod";
import { EventIdSchema, PokemonIdSchema, SoulLinkIdSchema } from "./identifiers.ts";
import { NonEmptyStringSchema } from "./common.ts";

export const SoulLinkSchema = z
  .object({
    id: SoulLinkIdSchema,
    pokemonIds: z.tuple([PokemonIdSchema, PokemonIdSchema]),
    createdByEventId: EventIdSchema,
    notes: NonEmptyStringSchema.optional(),
  })
  .strict()
  .refine((link) => link.pokemonIds[0] !== link.pokemonIds[1], {
    path: ["pokemonIds"],
    message: "A Soul Link must contain two different Pokémon.",
  });

export type SoulLink = z.infer<typeof SoulLinkSchema>;
