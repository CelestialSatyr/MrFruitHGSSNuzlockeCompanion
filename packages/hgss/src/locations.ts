import { z } from "zod";
import { EncounterOpportunityIdSchema, LocationIdSchema, RuleIdSchema } from "@nuzlocke/core";
import {
  HgssBadgeKeySchema,
  HgssCapabilityKeySchema,
  HgssMilestoneKeySchema,
} from "./progression.ts";

export const HgssProgressionConditionSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("badge"),
      key: HgssBadgeKeySchema,
      value: z.boolean().default(true),
    })
    .strict(),
  z
    .object({
      kind: z.literal("capability"),
      key: HgssCapabilityKeySchema,
      value: z.boolean().default(true),
    })
    .strict(),
  z
    .object({
      kind: z.literal("milestone"),
      key: HgssMilestoneKeySchema,
      value: z.boolean().default(true),
    })
    .strict(),
]);

export const HgssAvailabilityGroupSchema = z
  .object({
    allOf: z.array(HgssProgressionConditionSchema),
  })
  .strict();

export const HgssAvailabilitySchema = z
  .object({
    anyOf: z.array(HgssAvailabilityGroupSchema).min(1),
  })
  .strict();

export const HgssEncounterOpportunitySchema = z
  .object({
    id: EncounterOpportunityIdSchema,
    label: z.string().trim().min(1),
    kind: z.enum(["wild", "starter", "gift", "static", "trade", "other"]),
    availability: HgssAvailabilitySchema.optional(),
    defaultEnabled: z.boolean().default(true),
    ruleIds: z.array(RuleIdSchema).optional(),
    versions: z
      .array(z.enum(["heartgold", "soulsilver"]))
      .min(1)
      .max(2)
      .optional(),
  })
  .strict();

export const HgssMapAnchorSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
  })
  .strict();

export const HgssLocationSchema = z
  .object({
    id: LocationIdSchema,
    name: z.string().trim().min(1),
    region: z.enum(["johto", "kanto"]),
    kind: z.enum(["route", "town", "city", "cave", "forest", "building", "landmark", "other"]),
    mainGame: z.boolean(),
    order: z.number().int().min(0),
    availability: HgssAvailabilitySchema.optional(),
    map: z
      .object({
        anchor: HgssMapAnchorSchema,
        shapeId: z.string().trim().min(1).optional(),
      })
      .strict(),
    opportunities: z.array(HgssEncounterOpportunitySchema),
  })
  .strict();

export type HgssProgressionCondition = z.infer<typeof HgssProgressionConditionSchema>;
export type HgssAvailability = z.infer<typeof HgssAvailabilitySchema>;
export type HgssEncounterOpportunity = z.infer<typeof HgssEncounterOpportunitySchema>;
export type HgssLocation = z.infer<typeof HgssLocationSchema>;
