import { z } from "zod";
import { EpisodeSchema } from "./episode.ts";
import { RunEventSchema } from "./events.ts";
import { PlayerSchema } from "./player.ts";
import { PokemonSchema } from "./pokemon.ts";
import { RuleSchema } from "./rules.ts";
import { RunSchema } from "./run.ts";
import { SoulLinkSchema } from "./soul-link.ts";
import { EventTagDefinitionSchema } from "./tags.ts";

export const RunDatasetSchema = z
  .object({
    run: RunSchema,
    players: z.array(PlayerSchema),
    episodes: z.array(EpisodeSchema),
    pokemon: z.array(PokemonSchema),
    soulLinks: z.array(SoulLinkSchema),
    rules: z.array(RuleSchema),
    tags: z.array(EventTagDefinitionSchema),
    events: z.array(RunEventSchema),
  })
  .strict();

export type RunDataset = z.infer<typeof RunDatasetSchema>;

export function parseRunDataset(input: unknown): RunDataset {
  return RunDatasetSchema.parse(input);
}
