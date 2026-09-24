import type { RunDataset } from "../schemas/dataset.ts";
import { getOrderedRunEvents } from "./order.ts";
import {
  applyRunEvent,
  createInitialMutableRunState,
  createRunStateBuildContext,
} from "./reducer.ts";
import type { ReconstructionOptions, RunState } from "./types.ts";

export function reconstructRun<TGameState = undefined>(
  dataset: RunDataset,
  options: ReconstructionOptions<TGameState> = {},
): RunState<TGameState | undefined> {
  const context = createRunStateBuildContext(dataset, options.gameAdapter);
  const state = createInitialMutableRunState(options.gameAdapter);
  const events = getOrderedRunEvents(dataset, {
    cutoff: options.cutoff,
    episodeStatus: options.episodeStatus,
  });

  for (const { event, episode } of events) {
    applyRunEvent(state, event, episode.number, context);
  }

  return state;
}
