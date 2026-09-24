import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  getRunVisibleEpisodeBounds,
  getSeriesEpisodes,
  getVisibleSeriesRuns,
  parseRunSeries,
  resolveSpoilerState,
  type Episode,
  type RunDataset,
  type RunSeries,
  type RunState,
  type SpoilerMode,
} from "@nuzlocke/core";
import { reconstructHgssRun, type HgssProgressionState } from "@nuzlocke/hgss";
import { publishedSeries } from "../data/publishedDataset";

export type TimelineOrder = "newest-first" | "chronological";

interface StoredPreferences {
  spoilerMode: SpoilerMode;
  spoilerEpisode?: number;
  timelineOrder: TimelineOrder;
  selectedRunId?: string;
  spoilerPromptCompleted?: boolean;
  askSpoilerPromptEachVisit?: boolean;
}

interface VisibleRun {
  dataset: RunDataset;
  firstVisibleEpisodeNumber: number;
  lastVisibleEpisodeNumber: number;
}

interface VisibleRunView extends VisibleRun {
  state: RunState<HgssProgressionState>;
}

interface RunViewContextValue {
  series: RunSeries;
  dataset: RunDataset;
  visibleRuns: VisibleRun[];
  visibleRunViews: VisibleRunView[];
  selectedRunId: string;
  allViewEpisodes: Episode[];
  viewEpisodes: Episode[];
  state: RunState<HgssProgressionState>;
  spoilerMode: SpoilerMode;
  spoilerEpisode: number | undefined;
  visibleThroughEpisode: number;
  latestPublishedEpisode: number;
  timelineOrder: TimelineOrder;
  isDraftPreview: boolean;
  spoilerPromptOpen: boolean;
  askSpoilerPromptEachVisit: boolean;
  setSelectedRunId(runId: string): void;
  setSpoilerMode(mode: SpoilerMode): void;
  setSpoilerEpisode(episode: number): void;
  setTimelineOrder(order: TimelineOrder): void;
  setAskSpoilerPromptEachVisit(value: boolean): void;
  revealThroughEpisode(episode: number): void;
  completeSpoilerPrompt(episode: number, askAgain: boolean): void;
}

const STORAGE_KEY = "nuzlocke-companion.viewer-preferences.v3";
const LEGACY_STORAGE_KEYS = [
  "nuzlocke-companion.viewer-preferences.v2",
  "nuzlocke-companion.viewer-preferences.v1",
] as const;
const PROMPT_SESSION_KEY = "nuzlocke-companion.spoiler-prompt.seen-this-session";
const RunViewContext = createContext<RunViewContextValue | undefined>(undefined);

function parseStoredPreferences(raw: string | null): StoredPreferences | undefined {
  if (!raw) return undefined;
  try {
    const value = JSON.parse(raw) as Partial<StoredPreferences>;
    const spoilerMode: SpoilerMode =
      value.spoilerMode === "show-all" || value.spoilerMode === "episode"
        ? value.spoilerMode
        : "hide-latest";
    const timelineOrder: TimelineOrder =
      value.timelineOrder === "chronological" ? "chronological" : "newest-first";
    return {
      spoilerMode,
      timelineOrder,
      ...(typeof value.spoilerEpisode === "number" ? { spoilerEpisode: value.spoilerEpisode } : {}),
      ...(typeof value.selectedRunId === "string" ? { selectedRunId: value.selectedRunId } : {}),
      ...(typeof value.spoilerPromptCompleted === "boolean"
        ? { spoilerPromptCompleted: value.spoilerPromptCompleted }
        : {}),
      ...(typeof value.askSpoilerPromptEachVisit === "boolean"
        ? { askSpoilerPromptEachVisit: value.askSpoilerPromptEachVisit }
        : {}),
    };
  } catch {
    return undefined;
  }
}

function readPreferences(): StoredPreferences {
  if (typeof window === "undefined")
    return { spoilerMode: "hide-latest", timelineOrder: "newest-first" };

  const current = parseStoredPreferences(localStorage.getItem(STORAGE_KEY));
  if (current) return current;

  for (const key of LEGACY_STORAGE_KEYS) {
    const legacy = parseStoredPreferences(localStorage.getItem(key));
    if (legacy) return legacy;
  }

  return { spoilerMode: "hide-latest", timelineOrder: "newest-first" };
}

function persist(value: StoredPreferences) {
  if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

function shouldOpenSpoilerPrompt(): boolean {
  if (typeof window === "undefined") return false;
  const preferences = readPreferences();
  if (preferences.spoilerPromptCompleted !== true) return true;
  if (preferences.askSpoilerPromptEachVisit !== true) return false;
  return sessionStorage.getItem(PROMPT_SESSION_KEY) !== "1";
}

function wantsDraftPreview() {
  return (
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("preview") === "draft"
  );
}

export function RunViewProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<StoredPreferences>(readPreferences);
  const [series, setSeries] = useState<RunSeries>(publishedSeries);
  const [isDraftPreview, setDraftPreview] = useState(false);
  const [spoilerPromptOpen, setSpoilerPromptOpen] = useState<boolean>(shouldOpenSpoilerPrompt);

  useEffect(() => {
    if (!wantsDraftPreview()) return;
    let cancelled = false;
    void fetch("http://127.0.0.1:5174/api/editor/draft-dataset", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(`Draft preview failed (${response.status}).`);
        return response.json();
      })
      .then((value) => {
        if (!cancelled) {
          setSeries(parseRunSeries(value));
          setDraftPreview(true);
        }
      })
      .catch((error) => console.warn("Could not load local draft preview.", error));
    return () => {
      cancelled = true;
    };
  }, []);

  const episodeStatus = isDraftPreview ? ("all" as const) : ("published" as const);
  const allViewEpisodes = useMemo(
    () => getSeriesEpisodes(series, episodeStatus),
    [series, episodeStatus],
  );

  const spoilerEpisodes = useMemo(
    () => allViewEpisodes.map((episode) => ({ ...episode, status: "published" as const })),
    [allViewEpisodes],
  );

  const spoiler = useMemo(
    () =>
      resolveSpoilerState(spoilerEpisodes, {
        mode: preferences.spoilerMode,
        ...(preferences.spoilerEpisode !== undefined
          ? { episodeNumber: preferences.spoilerEpisode }
          : {}),
      }),
    [spoilerEpisodes, preferences.spoilerEpisode, preferences.spoilerMode],
  );

  const visibleRuns = useMemo<VisibleRun[]>(
    () =>
      getVisibleSeriesRuns(series, spoiler.visibleThroughEpisodeNumber, episodeStatus).flatMap(
        (dataset) => {
          const bounds = getRunVisibleEpisodeBounds(
            dataset,
            spoiler.visibleThroughEpisodeNumber,
            episodeStatus,
          );
          return bounds
            ? [
                {
                  dataset,
                  firstVisibleEpisodeNumber: bounds.first,
                  lastVisibleEpisodeNumber: bounds.last,
                },
              ]
            : [];
        },
      ),
    [series, spoiler.visibleThroughEpisodeNumber, episodeStatus],
  );

  const visibleRunViews = useMemo<VisibleRunView[]>(
    () =>
      visibleRuns.map((entry) => ({
        ...entry,
        state: reconstructHgssRun(entry.dataset, {
          cutoff: spoiler.cutoff,
          episodeStatus: isDraftPreview ? "all" : "published",
        }),
      })),
    [visibleRuns, spoiler.cutoff, isDraftPreview],
  );

  const selectedVisibleRun = useMemo(() => {
    const requested = preferences.selectedRunId
      ? visibleRuns.find((entry) => entry.dataset.run.id === preferences.selectedRunId)
      : undefined;
    return (
      requested ??
      visibleRuns.at(-1) ?? {
        dataset: series.runs[0]!,
        firstVisibleEpisodeNumber: series.runs[0]?.episodes[0]?.number ?? 1,
        lastVisibleEpisodeNumber: series.runs[0]?.episodes.at(-1)?.number ?? 1,
      }
    );
  }, [preferences.selectedRunId, series.runs, visibleRuns]);

  const dataset = selectedVisibleRun.dataset;
  const selectedRunId = dataset.run.id;
  const viewEpisodes = useMemo(
    () =>
      episodeStatus === "all"
        ? dataset.episodes
        : dataset.episodes.filter((episode) => episode.status === "published"),
    [dataset, episodeStatus],
  );
  const state = useMemo(
    () =>
      visibleRunViews.find((entry) => entry.dataset.run.id === dataset.run.id)?.state ??
      reconstructHgssRun(dataset, {
        cutoff: spoiler.cutoff,
        episodeStatus: isDraftPreview ? "all" : "published",
      }),
    [dataset, isDraftPreview, spoiler.cutoff, visibleRunViews],
  );

  function update(next: StoredPreferences) {
    setPreferences(next);
    persist(next);
  }

  const value = useMemo<RunViewContextValue>(
    () => ({
      series,
      dataset,
      visibleRuns,
      visibleRunViews,
      selectedRunId,
      allViewEpisodes,
      viewEpisodes,
      state,
      spoilerMode: preferences.spoilerMode,
      spoilerEpisode: preferences.spoilerEpisode,
      visibleThroughEpisode: spoiler.visibleThroughEpisodeNumber,
      latestPublishedEpisode: spoiler.latestPublishedEpisodeNumber,
      timelineOrder: preferences.timelineOrder,
      isDraftPreview,
      spoilerPromptOpen,
      askSpoilerPromptEachVisit: preferences.askSpoilerPromptEachVisit === true,
      setSelectedRunId(runId) {
        if (!visibleRuns.some((entry) => entry.dataset.run.id === runId)) return;
        update({ ...preferences, selectedRunId: runId });
      },
      setSpoilerMode(mode) {
        update({ ...preferences, spoilerMode: mode });
      },
      setSpoilerEpisode(episode) {
        update({ ...preferences, spoilerMode: "episode", spoilerEpisode: episode });
      },
      setTimelineOrder(order) {
        update({ ...preferences, timelineOrder: order });
      },
      setAskSpoilerPromptEachVisit(nextValue) {
        update({
          ...preferences,
          spoilerPromptCompleted: true,
          askSpoilerPromptEachVisit: nextValue,
        });
      },
      revealThroughEpisode(episode) {
        update({ ...preferences, spoilerMode: "episode", spoilerEpisode: episode });
      },
      completeSpoilerPrompt(episode, askAgain) {
        const next: StoredPreferences = {
          ...preferences,
          spoilerMode: "episode",
          spoilerEpisode: episode,
          spoilerPromptCompleted: true,
          askSpoilerPromptEachVisit: askAgain,
        };
        update(next);
        if (typeof window !== "undefined") sessionStorage.setItem(PROMPT_SESSION_KEY, "1");
        setSpoilerPromptOpen(false);
      },
    }),
    [
      allViewEpisodes,
      dataset,
      isDraftPreview,
      preferences,
      selectedRunId,
      series,
      spoiler.latestPublishedEpisodeNumber,
      spoiler.visibleThroughEpisodeNumber,
      spoilerPromptOpen,
      state,
      viewEpisodes,
      visibleRuns,
      visibleRunViews,
    ],
  );

  return <RunViewContext.Provider value={value}>{children}</RunViewContext.Provider>;
}

export function useRunView() {
  const context = useContext(RunViewContext);
  if (!context) throw new Error("useRunView must be used inside RunViewProvider.");
  return context;
}
