import { z } from "zod";
import { GameIdSchema, PlayerIdSchema, RunIdSchema } from "./identifiers.ts";
import { IsoDateTimeSchema, NonEmptyStringSchema } from "./common.ts";

export const CURRENT_SCHEMA_VERSION = 1 as const;

export const RunStatusSchema = z.enum(["planning", "active", "failed", "abandoned", "complete"]);
export type RunStatus = z.infer<typeof RunStatusSchema>;

export const RunSchema = z
  .object({
    schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
    id: RunIdSchema,
    title: NonEmptyStringSchema,
    gameId: GameIdSchema,
    status: RunStatusSchema,
    attemptNumber: z.number().int().positive().optional(),
    scope: z.enum(["main-story", "full-game"]),
    playerIds: z.array(PlayerIdSchema).max(2),
    description: NonEmptyStringSchema.optional(),
    startedAt: IsoDateTimeSchema.optional(),
    completedAt: IsoDateTimeSchema.optional(),
  })
  .strict()
  .superRefine((run, context) => {
    if (run.status !== "planning" && run.playerIds.length !== 2) {
      context.addIssue({
        code: "custom",
        path: ["playerIds"],
        message: "An active or completed Soul Link run must have exactly two players.",
      });
    }

    if (run.status === "complete" && run.completedAt === undefined) {
      context.addIssue({
        code: "custom",
        path: ["completedAt"],
        message: "A completed run must include completedAt.",
      });
    }
  });

export type Run = z.infer<typeof RunSchema>;
