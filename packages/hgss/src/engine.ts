import {
  reconstructRun,
  type GameStateAdapter,
  type ReconstructionOptions,
  type RunDataset,
  type RunEvent,
  type RunState,
} from "@nuzlocke/core";
import {
  createInitialHgssProgressionState,
  isHgssProgressionFlag,
  type HgssProgressionState,
} from "./progression.ts";

export const hgssGameStateAdapter: GameStateAdapter<HgssProgressionState> = {
  gameId: "heartgold-soulsilver",
  createInitialState: createInitialHgssProgressionState,
  applyEvent(state, event) {
    applyHgssProgressionEvent(state, event);
  },
  validateProgressionFlag(flag) {
    return isHgssProgressionFlag(flag.kind, flag.id);
  },
};

export function reconstructHgssRun(
  dataset: RunDataset,
  options: Omit<ReconstructionOptions<HgssProgressionState>, "gameAdapter"> = {},
): RunState<HgssProgressionState> {
  return reconstructRun(dataset, {
    ...options,
    gameAdapter: hgssGameStateAdapter,
  }) as RunState<HgssProgressionState>;
}

export function applyHgssProgressionEvent(state: HgssProgressionState, event: RunEvent): void {
  if (event.type === "gym-battle" && event.result === "win" && event.badgeId !== undefined) {
    if (isHgssProgressionFlag("badge", event.badgeId)) {
      state.badges[event.badgeId as keyof HgssProgressionState["badges"]] = true;
    }
    return;
  }

  if (event.type !== "progression-changed") return;
  if (!isHgssProgressionFlag(event.flag.kind, event.flag.id)) return;

  switch (event.flag.kind) {
    case "badge":
      state.badges[event.flag.id as keyof HgssProgressionState["badges"]] = event.flag.value;
      break;
    case "capability":
      state.capabilities[event.flag.id as keyof HgssProgressionState["capabilities"]] =
        event.flag.value;
      break;
    case "milestone":
      state.milestones[event.flag.id as keyof HgssProgressionState["milestones"]] =
        event.flag.value;
      break;
  }
}
