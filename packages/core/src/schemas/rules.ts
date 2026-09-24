import { z } from "zod";
import { RuleIdSchema } from "./identifiers.ts";
import { NonEmptyStringSchema } from "./common.ts";

export const RuleCategorySchema = z.enum([
  "encounters",
  "soul-link",
  "deaths",
  "party",
  "items",
  "battle",
  "exceptions",
  "other",
]);

export const RuleVersionSchema = z
  .object({
    effectiveFromEpisode: z.number().int().positive(),
    summary: NonEmptyStringSchema,
    description: NonEmptyStringSchema,
  })
  .strict();

export const RuleSchema = z
  .object({
    id: RuleIdSchema,
    title: NonEmptyStringSchema,
    category: RuleCategorySchema,
    shortSummary: NonEmptyStringSchema,
    versions: z.array(RuleVersionSchema).min(1),
  })
  .strict()
  .superRefine((rule, context) => {
    const episodeNumbers = rule.versions.map((version) => version.effectiveFromEpisode);
    const uniqueEpisodeNumbers = new Set(episodeNumbers);

    if (episodeNumbers.length !== uniqueEpisodeNumbers.size) {
      context.addIssue({
        code: "custom",
        path: ["versions"],
        message: "A rule may only have one version beginning in a given episode.",
      });
    }

    for (let index = 1; index < episodeNumbers.length; index += 1) {
      const previous = episodeNumbers[index - 1];
      const current = episodeNumbers[index];
      if (previous !== undefined && current !== undefined && current <= previous) {
        context.addIssue({
          code: "custom",
          path: ["versions", index, "effectiveFromEpisode"],
          message: "Rule versions must be stored in ascending episode order.",
        });
      }
    }
  });

export type RuleCategory = z.infer<typeof RuleCategorySchema>;
export type RuleVersion = z.infer<typeof RuleVersionSchema>;
export type Rule = z.infer<typeof RuleSchema>;
