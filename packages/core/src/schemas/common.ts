import { z } from "zod";
import { EventIdSchema, RuleIdSchema, TagIdSchema } from "./identifiers.ts";

export const NonEmptyStringSchema = z.string().trim().min(1);
export const OptionalNonEmptyStringSchema = NonEmptyStringSchema.optional();
export const IsoDateTimeSchema = z.iso.datetime({ offset: true });
export const WebUrlSchema = z.url();
export const PokemonSpeciesIdSchema = z.number().int().positive();
export const VideoTimestampSecondsSchema = z.number().int().min(0);

export const PokemonGenderSchema = z.enum(["male", "female", "genderless", "unknown"]);
export type PokemonGender = z.infer<typeof PokemonGenderSchema>;

export const EventToneSchema = z.enum(["positive", "negative", "neutral", "mixed"]);
export type EventTone = z.infer<typeof EventToneSchema>;

export const EventImportanceSchema = z.enum(["minor", "normal", "major"]);
export type EventImportance = z.infer<typeof EventImportanceSchema>;

export const EventVisibilitySchema = z
  .object({
    runTimeline: z.boolean().optional(),
    pokemonHistory: z.boolean().optional(),
    soulLinkHistory: z.boolean().optional(),
    playback: z.boolean().optional(),
    highlights: z.boolean().optional(),
  })
  .strict();
export type EventVisibility = z.infer<typeof EventVisibilitySchema>;

export const EventPresentationSchema = z
  .object({
    featured: z.boolean().optional(),
    cinematic: z.boolean().optional(),
    sceneId: NonEmptyStringSchema.optional(),
    emphasis: z.enum(["default", "celebration", "warning", "dramatic", "quiet"]).optional(),
  })
  .strict();
export type EventPresentation = z.infer<typeof EventPresentationSchema>;

export const EventTagAssignmentSchema = z
  .object({
    tagId: TagIdSchema,
    detail: NonEmptyStringSchema.optional(),
  })
  .strict();
export type EventTagAssignment = z.infer<typeof EventTagAssignmentSchema>;

export const EventAnnotationSchema = z
  .object({
    kind: z.enum(["note", "community", "rules", "correction", "context"]),
    text: NonEmptyStringSchema,
    ruleId: RuleIdSchema.optional(),
  })
  .strict();
export type EventAnnotation = z.infer<typeof EventAnnotationSchema>;

export const RelatedEventIdsSchema = z.array(EventIdSchema).max(20);
