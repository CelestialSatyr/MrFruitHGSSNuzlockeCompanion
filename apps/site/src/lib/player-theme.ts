import type { Player, RunDataset } from "@nuzlocke/core";

export type PlayerTheme = "gold" | "silver";

export function getPlayerTheme(player: Pick<Player, "gameVersionId">): PlayerTheme {
  return player.gameVersionId === "heartgold" ? "gold" : "silver";
}

export function getPlayerGameLabel(player: Pick<Player, "gameVersionId">): string {
  return player.gameVersionId === "heartgold" ? "HeartGold" : "SoulSilver";
}

export function getPlayerForTheme(
  dataset: Pick<RunDataset, "run" | "players">,
  theme: PlayerTheme,
): Player | undefined {
  for (const playerId of dataset.run.playerIds) {
    const player = dataset.players.find((entry) => entry.id === playerId);
    if (player && getPlayerTheme(player) === theme) return player;
  }

  return undefined;
}
