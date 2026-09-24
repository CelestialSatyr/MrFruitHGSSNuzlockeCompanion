export const CORE_VERSION = "0.4-series" as const;

export * from "./schemas/common.ts";
export * from "./schemas/dataset.ts";
export * from "./schemas/episode.ts";
export * from "./schemas/events.ts";
export * from "./schemas/identifiers.ts";
export * from "./schemas/player.ts";
export * from "./schemas/pokemon.ts";
export * from "./schemas/rules.ts";
export * from "./schemas/run.ts";
export * from "./schemas/series.ts";
export * from "./schemas/soul-link.ts";
export * from "./schemas/tags.ts";

export interface FoundationLayer {
  id: "site" | "editor" | "core";
  name: string;
  scope: string;
  description: string;
}

export interface FoundationDescription {
  layers: readonly FoundationLayer[];
}

export function describeFoundation(): FoundationDescription {
  return {
    layers: [
      {
        id: "site",
        name: "Public Companion",
        scope: "Read only",
        description:
          "The viewer and player experience: spoiler-aware history, Pokémon profiles, Soul Links, rules, map and encounter planning.",
      },
      {
        id: "editor",
        name: "Local Run Editor",
        scope: "Local only",
        description:
          "The authoring workflow for episodes, events, YouTube timestamps, validation, previews and safe Git publishing.",
      },
      {
        id: "core",
        name: "Shared Core",
        scope: "Single source",
        description:
          "Schemas, state reconstruction, spoiler cutoffs, domain validation and selectors shared by both applications.",
      },
    ],
  };
}

export * from "./selectors/run-selectors.ts";
export * from "./state/event-references.ts";
export * from "./state/order.ts";
export * from "./state/reconstruct.ts";
export * from "./state/types.ts";
export * from "./validation/semantic-validation.ts";
export * from "./state/spoilers.ts";
export * from "./state/series.ts";
