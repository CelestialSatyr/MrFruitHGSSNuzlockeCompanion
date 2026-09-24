export const GAME_ID = "heartgold-soulsilver" as const;
export const GAME_LABEL = "Pokémon HeartGold / SoulSilver" as const;
export const HEARTGOLD_VERSION_ID = "heartgold" as const;
export const SOULSILVER_VERSION_ID = "soulsilver" as const;

export const HGSS_SCOPE = {
  mainGameOnly: true,
  postGameEnabled: false,
} as const;

export * from "./locations.ts";
export * from "./progression.ts";

export * from "./availability.ts";
export * from "./engine.ts";

export * from "./data/main-story-locations.ts";
