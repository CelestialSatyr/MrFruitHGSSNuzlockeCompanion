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

function applyBlackthornProgressionClosure(state: HgssProgressionState): void {
  // A recorded Clair victory proves the run has already traversed the mandatory
  // Johto story gates needed to reach Blackthorn City. Keep the encounter map
  // resilient when one of those helper progression flags was not authored
  // separately.
  state.badges.zephyr = true;
  state.badges.hive = true;
  state.badges.plain = true;
  state.badges.fog = true;
  state.badges.storm = true;
  state.badges.mineral = true;
  state.badges.glacier = true;
  state.capabilities.strength = true;
  state.milestones.radioTowerCleared = true;
}

export function applyHgssProgressionEvent(state: HgssProgressionState, event: RunEvent): void {
  if (event.type === "gym-battle" && event.result === "win") {
    if (event.gymId === "blackthorn-gym") {
      applyBlackthornProgressionClosure(state);
      state.milestones.blackthornGymDefeated = true;
    }

    if (event.badgeId !== undefined && isHgssProgressionFlag("badge", event.badgeId)) {
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
