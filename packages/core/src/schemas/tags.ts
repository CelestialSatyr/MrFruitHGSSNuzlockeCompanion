import { z } from "zod";
import { TagIdSchema } from "./identifiers.ts";
import { NonEmptyStringSchema } from "./common.ts";

export const TagStyleSchema = z.enum([
  "celebration",
  "info",
  "warning",
  "rules",
  "fun",
  "historic",
]);

export const EventTagDefinitionSchema = z
  .object({
    id: TagIdSchema,
    label: NonEmptyStringSchema,
    description: NonEmptyStringSchema.optional(),
    style: TagStyleSchema,
  })
  .strict();

export type TagStyle = z.infer<typeof TagStyleSchema>;
export type EventTagDefinition = z.infer<typeof EventTagDefinitionSchema>;
