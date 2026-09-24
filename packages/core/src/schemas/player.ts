import { z } from "zod";
import { GameIdSchema, PlayerIdSchema } from "./identifiers.ts";
import { NonEmptyStringSchema, WebUrlSchema } from "./common.ts";

export const PlayerSchema = z
  .object({
    id: PlayerIdSchema,
    displayName: NonEmptyStringSchema,
    shortName: NonEmptyStringSchema.optional(),
    gameVersionId: GameIdSchema,
    avatarUrl: WebUrlSchema.optional(),
    channelUrl: WebUrlSchema.optional(),
  })
  .strict();

export type Player = z.infer<typeof PlayerSchema>;
