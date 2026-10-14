import { z } from "zod";
import {
  BadgeIdSchema,
  EncounterOpportunityIdSchema,
  EpisodeIdSchema,
  EventIdSchema,
  GymIdSchema,
  LocationIdSchema,
  PlayerIdSchema,
  PokemonIdSchema,
  RuleIdSchema,
  SoulLinkIdSchema,
} from "./identifiers.ts";
import {
  EventAnnotationSchema,
  EventImportanceSchema,
  EventPresentationSchema,
  EventTagAssignmentSchema,
  EventToneSchema,
  EventVisibilitySchema,
  NonEmptyStringSchema,
  PokemonSpeciesIdSchema,
  RelatedEventIdsSchema,
  VideoTimestampSecondsSchema,
} from "./common.ts";

const EventBaseShape = {
  id: EventIdSchema,
  episodeId: EpisodeIdSchema,
  sequence: z.number().int().min(0),
  videoTimestampSeconds: VideoTimestampSecondsSchema.optional(),
  tone: EventToneSchema,
  importance: EventImportanceSchema,
  title: NonEmptyStringSchema.optional(),
  description: NonEmptyStringSchema.optional(),
  tags: z.array(EventTagAssignmentSchema).max(12).optional(),
  annotations: z.array(EventAnnotationSchema).max(12).optional(),
  relatedEventIds: RelatedEventIdsSchema.optional(),
  visibility: EventVisibilitySchema.optional(),
  presentation: EventPresentationSchema.optional(),
} as const;

const CaughtEncounterOutcomeSchema = z
  .object({
    result: z.literal("caught"),
    playerId: PlayerIdSchema,
    pokemonId: PokemonIdSchema,
    speciesId: PokemonSpeciesIdSchema,
    level: z.number().int().positive().optional(),
    nickname: NonEmptyStringSchema.optional(),
    placement: z.enum(["party", "box"]).optional(),
    /** Capture-time Flying Clause decision. Undefined is retained for historical data. */
    flyingTypeDeclared: z.boolean().optional(),
  })
  .strict();

const FailedEncounterOutcomeSchema = z
  .object({
    result: z.literal("failed"),
    playerId: PlayerIdSchema,
    speciesId: PokemonSpeciesIdSchema.optional(),
    reason: NonEmptyStringSchema.optional(),
  })
  .strict();

const SkippedEncounterOutcomeSchema = z
  .object({
    result: z.literal("skipped"),
    playerId: PlayerIdSchema,
    speciesId: PokemonSpeciesIdSchema.optional(),
    reason: NonEmptyStringSchema.optional(),
  })
  .strict();

export const EncounterOutcomeSchema = z.discriminatedUnion("result", [
  CaughtEncounterOutcomeSchema,
  FailedEncounterOutcomeSchema,
  SkippedEncounterOutcomeSchema,
]);

export const EncounterEventSchema = z
  .object({
    ...EventBaseShape,
    type: z.literal("encounter"),
    locationId: LocationIdSchema,
    opportunityId: EncounterOpportunityIdSchema,
    acquisitionType: z.enum(["wild", "starter", "gift", "static", "trade", "other"]),
    outcomes: z.tuple([EncounterOutcomeSchema, EncounterOutcomeSchema]),
    soulLinkId: SoulLinkIdSchema.optional(),
  })
  .strict()
  .superRefine((event, context) => {
    const [left, right] = event.outcomes;
    if (left.playerId === right.playerId) {
      context.addIssue({
        code: "custom",
        path: ["outcomes"],
        message: "An encounter must contain one outcome for each of the two players.",
      });
    }

    const bothCaught = left.result === "caught" && right.result === "caught";
    if (bothCaught && event.soulLinkId === undefined) {
      context.addIssue({
        code: "custom",
        path: ["soulLinkId"],
        message: "A successful paired encounter must create a Soul Link.",
      });
    }

    if (!bothCaught && event.soulLinkId !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["soulLinkId"],
        message: "A failed or skipped paired encounter cannot create a Soul Link.",
      });
    }
  });

export const NicknameChangedEventSchema = z
  .object({
    ...EventBaseShape,
    type: z.literal("nickname-changed"),
    pokemonId: PokemonIdSchema,
    fromNickname: NonEmptyStringSchema.optional(),
    toNickname: NonEmptyStringSchema,
  })
  .strict();

export const EvolutionEventSchema = z
  .object({
    ...EventBaseShape,
    type: z.literal("evolution"),
    pokemonId: PokemonIdSchema,
    fromSpeciesId: PokemonSpeciesIdSchema,
    toSpeciesId: PokemonSpeciesIdSchema,
    level: z.number().int().positive().optional(),
  })
  .strict()
  .refine((event) => event.fromSpeciesId !== event.toSpeciesId, {
    path: ["toSpeciesId"],
    message: "An evolution must change the Pokémon species.",
  });

const PartyChangePairSchema = z
  .object({
    soulLinkId: SoulLinkIdSchema,
    pokemonIds: z.tuple([PokemonIdSchema, PokemonIdSchema]),
    to: z.enum(["party", "box"]),
  })
  .strict();

export const PartyChangedEventSchema = z
  .object({
    ...EventBaseShape,
    type: z.literal("party-changed"),
    /**
     * New authoring shape: one event can move several complete Soul Link pairs,
     * and each pair may independently go to the party or the box.
     */
    pairChanges: z.array(PartyChangePairSchema).min(1).max(6).optional(),
    /** Legacy shape retained so existing published history remains readable. */
    pokemonIds: z.array(PokemonIdSchema).min(1).max(12).optional(),
    /** Legacy destination retained for older events (and manual retirement history). */
    to: z.enum(["party", "box", "retired"]).optional(),
    reason: NonEmptyStringSchema.optional(),
  })
  .strict()
  .superRefine((event, context) => {
    const hasPairChanges = Boolean(event.pairChanges?.length);
    const hasLegacyChange = Boolean(event.pokemonIds?.length && event.to);

    if (!hasPairChanges && !hasLegacyChange) {
      context.addIssue({
        code: "custom",
        path: ["pairChanges"],
        message: "A party change must contain at least one Soul Link pair movement.",
      });
    }

    if (hasPairChanges && hasLegacyChange) {
      context.addIssue({
        code: "custom",
        path: ["pairChanges"],
        message: "Use either pairChanges or the legacy pokemonIds/to fields, not both.",
      });
    }

    const seenLinks = new Set<string>();
    for (const change of event.pairChanges ?? []) {
      if (seenLinks.has(change.soulLinkId)) {
        context.addIssue({
          code: "custom",
          path: ["pairChanges"],
          message: `Soul Link ${change.soulLinkId} is listed more than once in this party change.`,
        });
      }
      seenLinks.add(change.soulLinkId);
    }
  });

export const LevelMilestoneEventSchema = z
  .object({
    ...EventBaseShape,
    type: z.literal("level-milestone"),
    pokemonId: PokemonIdSchema,
    level: z.number().int().positive(),
    label: NonEmptyStringSchema.optional(),
  })
  .strict();

export const MoveChangedEventSchema = z
  .object({
    ...EventBaseShape,
    type: z.literal("move-changed"),
    pokemonId: PokemonIdSchema,
    learnedMoveId: NonEmptyStringSchema.optional(),
    forgottenMoveId: NonEmptyStringSchema.optional(),
  })
  .strict()
  .refine((event) => event.learnedMoveId !== undefined || event.forgottenMoveId !== undefined, {
    path: ["learnedMoveId"],
    message: "A move change must learn, forget, or replace at least one move.",
  });

export const HeldItemChangedEventSchema = z
  .object({
    ...EventBaseShape,
    type: z.literal("held-item-changed"),
    pokemonId: PokemonIdSchema,
    fromItemId: NonEmptyStringSchema.optional(),
    toItemId: NonEmptyStringSchema.optional(),
  })
  .strict()
  .refine((event) => event.fromItemId !== undefined || event.toItemId !== undefined, {
    path: ["toItemId"],
    message: "A held-item change must add, remove, or replace an item.",
  });

export const AbilityChangedEventSchema = z
  .object({
    ...EventBaseShape,
    type: z.literal("ability-changed"),
    pokemonId: PokemonIdSchema,
    fromAbilityId: NonEmptyStringSchema.optional(),
    toAbilityId: NonEmptyStringSchema,
  })
  .strict();

export const FormChangedEventSchema = z
  .object({
    ...EventBaseShape,
    type: z.literal("form-changed"),
    pokemonId: PokemonIdSchema,
    fromFormId: NonEmptyStringSchema.optional(),
    toFormId: NonEmptyStringSchema,
  })
  .strict();

export const GymBattleEventSchema = z
  .object({
    ...EventBaseShape,
    type: z.literal("gym-battle"),
    gymId: GymIdSchema,
    leaderName: NonEmptyStringSchema,
    result: z.enum(["win", "loss"]),
    participantPokemonIds: z.array(PokemonIdSchema).min(1).max(12),
    badgeId: BadgeIdSchema.optional(),
  })
  .strict()
  .superRefine((event, context) => {
    if (event.result === "loss" && event.badgeId !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["badgeId"],
        message: "A lost Gym battle cannot award a badge.",
      });
    }
  });

export const MajorBattleEventSchema = z
  .object({
    ...EventBaseShape,
    type: z.literal("major-battle"),
    battleName: NonEmptyStringSchema,
    result: z.enum(["win", "loss", "draw", "escaped", "other"]),
    participantPokemonIds: z.array(PokemonIdSchema).min(1).max(12),
  })
  .strict();

export const PokemonDeathEventSchema = z
  .object({
    ...EventBaseShape,
    type: z.literal("pokemon-death"),
    pokemonId: PokemonIdSchema,
    locationId: LocationIdSchema.optional(),
    opponentSpeciesId: PokemonSpeciesIdSchema.optional(),
    opponentName: NonEmptyStringSchema.optional(),
    moveName: NonEmptyStringSchema.optional(),
    cause: NonEmptyStringSchema,
  })
  .strict();

export const PokemonRevivedEventSchema = z
  .object({
    ...EventBaseShape,
    type: z.literal("pokemon-revived"),
    pokemonId: PokemonIdSchema,
    reason: NonEmptyStringSchema,
  })
  .strict();

export const ProgressionChangedEventSchema = z
  .object({
    ...EventBaseShape,
    type: z.literal("progression-changed"),
    flag: z
      .object({
        kind: z.enum(["badge", "capability", "milestone"]),
        id: NonEmptyStringSchema,
        value: z.boolean(),
      })
      .strict(),
  })
  .strict();

export const SpecialMomentEventSchema = z
  .object({
    ...EventBaseShape,
    type: z.literal("special-moment"),
    title: NonEmptyStringSchema,
    description: NonEmptyStringSchema,
    pokemonIds: z.array(PokemonIdSchema).max(12).optional(),
    soulLinkIds: z.array(SoulLinkIdSchema).max(6).optional(),
  })
  .strict();

export const RuleRulingEventSchema = z
  .object({
    ...EventBaseShape,
    type: z.literal("rule-ruling"),
    ruleId: RuleIdSchema,
    ruling: z.enum(["violation", "dispute", "exception", "clarification"]),
    details: NonEmptyStringSchema,
    affectedEventIds: z.array(EventIdSchema).max(20).optional(),
  })
  .strict();

export const CustomEventSchema = z
  .object({
    ...EventBaseShape,
    type: z.literal("custom"),
    title: NonEmptyStringSchema,
    description: NonEmptyStringSchema,
    pokemonIds: z.array(PokemonIdSchema).max(12).optional(),
    soulLinkIds: z.array(SoulLinkIdSchema).max(6).optional(),
    locationId: LocationIdSchema.optional(),
  })
  .strict();

export const RunEventSchema = z.discriminatedUnion("type", [
  EncounterEventSchema,
  NicknameChangedEventSchema,
  EvolutionEventSchema,
  PartyChangedEventSchema,
  LevelMilestoneEventSchema,
  MoveChangedEventSchema,
  HeldItemChangedEventSchema,
  AbilityChangedEventSchema,
  FormChangedEventSchema,
  GymBattleEventSchema,
  MajorBattleEventSchema,
  PokemonDeathEventSchema,
  PokemonRevivedEventSchema,
  ProgressionChangedEventSchema,
  SpecialMomentEventSchema,
  RuleRulingEventSchema,
  CustomEventSchema,
]);

export type EncounterOutcome = z.infer<typeof EncounterOutcomeSchema>;
export type EncounterEvent = z.infer<typeof EncounterEventSchema>;
export type NicknameChangedEvent = z.infer<typeof NicknameChangedEventSchema>;
export type EvolutionEvent = z.infer<typeof EvolutionEventSchema>;
export type PartyChangedEvent = z.infer<typeof PartyChangedEventSchema>;
export type LevelMilestoneEvent = z.infer<typeof LevelMilestoneEventSchema>;
export type MoveChangedEvent = z.infer<typeof MoveChangedEventSchema>;
export type HeldItemChangedEvent = z.infer<typeof HeldItemChangedEventSchema>;
export type AbilityChangedEvent = z.infer<typeof AbilityChangedEventSchema>;
export type FormChangedEvent = z.infer<typeof FormChangedEventSchema>;
export type GymBattleEvent = z.infer<typeof GymBattleEventSchema>;
export type MajorBattleEvent = z.infer<typeof MajorBattleEventSchema>;
export type PokemonDeathEvent = z.infer<typeof PokemonDeathEventSchema>;
export type PokemonRevivedEvent = z.infer<typeof PokemonRevivedEventSchema>;
export type ProgressionChangedEvent = z.infer<typeof ProgressionChangedEventSchema>;
export type SpecialMomentEvent = z.infer<typeof SpecialMomentEventSchema>;
export type RuleRulingEvent = z.infer<typeof RuleRulingEventSchema>;
export type CustomEvent = z.infer<typeof CustomEventSchema>;
export type RunEvent = z.infer<typeof RunEventSchema>;
export type EventType = RunEvent["type"];
