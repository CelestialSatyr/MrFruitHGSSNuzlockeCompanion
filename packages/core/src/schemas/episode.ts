import { z } from "zod";
import { EpisodeIdSchema } from "./identifiers.ts";
import { IsoDateTimeSchema, NonEmptyStringSchema, WebUrlSchema } from "./common.ts";

export const YouTubeThumbnailSchema = z
  .object({
    url: WebUrlSchema,
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  })
  .strict();

export const YouTubeEpisodeMetadataSchema = z
  .object({
    videoId: NonEmptyStringSchema,
    url: WebUrlSchema,
    title: NonEmptyStringSchema,
    description: z.string(),
    channelTitle: NonEmptyStringSchema,
    publishedAt: IsoDateTimeSchema,
    durationSeconds: z.number().int().min(0),
    thumbnail: YouTubeThumbnailSchema,
  })
  .strict();

export const EpisodeSchema = z
  .object({
    id: EpisodeIdSchema,
    number: z.number().int().positive(),
    status: z.enum(["draft", "published"]),
    titleOverride: NonEmptyStringSchema.optional(),
    summary: NonEmptyStringSchema.optional(),
    youtube: YouTubeEpisodeMetadataSchema.optional(),
  })
  .strict();

export type YouTubeEpisodeMetadata = z.infer<typeof YouTubeEpisodeMetadataSchema>;
export type Episode = z.infer<typeof EpisodeSchema>;
