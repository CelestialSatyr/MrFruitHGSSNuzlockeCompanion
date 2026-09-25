import { z } from "zod";
import { NonEmptyStringSchema } from "./common.ts";
import { RunDatasetSchema } from "./dataset.ts";

export const SiteNoticeTypeSchema = z.enum(["note", "info", "success", "warning", "error"]);

const SiteNoticeLinkSchema = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (value) => !value || value.startsWith("/") || /^https?:\/\//i.test(value),
    "Site notice links must be a /relative path or an http(s) URL.",
  );

export const SiteNoticeSchema = z
  .object({
    id: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Site notice IDs must use lowercase kebab-case."),
    enabled: z.boolean(),
    type: SiteNoticeTypeSchema,
    title: z.string().trim().max(120).optional(),
    message: z.string().trim().max(1200),
    dismissible: z.boolean(),
    linkLabel: z.string().trim().max(80).optional(),
    linkUrl: SiteNoticeLinkSchema.optional(),
  })
  .strict()
  .superRefine((notice, context) => {
    if (notice.enabled && !notice.message.trim()) {
      context.addIssue({
        code: "custom",
        path: ["message"],
        message: "An enabled site notice needs a message.",
      });
    }
  });

export type SiteNoticeType = z.infer<typeof SiteNoticeTypeSchema>;
export type SiteNotice = z.infer<typeof SiteNoticeSchema>;

export const RunSeriesSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Series IDs must use lowercase kebab-case."),
    title: NonEmptyStringSchema,
    siteNotice: SiteNoticeSchema.optional(),
    runs: z.array(RunDatasetSchema).min(1),
  })
  .strict()
  .superRefine((series, context) => {
    const runIds = new Set<string>();
    const episodeIds = new Set<string>();
    const episodeNumbers = new Set<number>();
    const eventIds = new Set<string>();
    const pokemonIds = new Set<string>();
    const soulLinkIds = new Set<string>();

    series.runs.forEach((dataset, runIndex) => {
      if (runIds.has(dataset.run.id)) {
        context.addIssue({
          code: "custom",
          path: ["runs", runIndex, "run", "id"],
          message: `Duplicate run ID: ${dataset.run.id}`,
        });
      }
      runIds.add(dataset.run.id);

      const checkGlobalId = (
        id: string,
        collection: Set<string>,
        path: Array<string | number>,
        label: string,
      ) => {
        if (collection.has(id)) {
          context.addIssue({
            code: "custom",
            path,
            message: `${label} IDs must be unique across the entire series: ${id}`,
          });
        }
        collection.add(id);
      };

      dataset.events.forEach((event, eventIndex) =>
        checkGlobalId(event.id, eventIds, ["runs", runIndex, "events", eventIndex, "id"], "Event"),
      );
      dataset.pokemon.forEach((pokemon, pokemonIndex) =>
        checkGlobalId(
          pokemon.id,
          pokemonIds,
          ["runs", runIndex, "pokemon", pokemonIndex, "id"],
          "Pokémon",
        ),
      );
      dataset.soulLinks.forEach((link, linkIndex) =>
        checkGlobalId(
          link.id,
          soulLinkIds,
          ["runs", runIndex, "soulLinks", linkIndex, "id"],
          "Soul Link",
        ),
      );

      dataset.episodes.forEach((episode, episodeIndex) => {
        if (episodeIds.has(episode.id)) {
          context.addIssue({
            code: "custom",
            path: ["runs", runIndex, "episodes", episodeIndex, "id"],
            message: `Episode IDs must be unique across the entire series: ${episode.id}`,
          });
        }
        episodeIds.add(episode.id);

        if (episodeNumbers.has(episode.number)) {
          context.addIssue({
            code: "custom",
            path: ["runs", runIndex, "episodes", episodeIndex, "number"],
            message: `Episode numbers must be unique across the entire series: Episode ${episode.number}`,
          });
        }
        episodeNumbers.add(episode.number);
      });
    });
  });

export type RunSeries = z.infer<typeof RunSeriesSchema>;

export function parseRunSeries(input: unknown): RunSeries {
  return RunSeriesSchema.parse(input);
}
