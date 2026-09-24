import { HGSS_MAIN_STORY_LOCATIONS } from "@nuzlocke/hgss";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { EncounterPlanner } from "../components/EncounterPlanner";
import { HgssRunMap } from "../components/HgssRunMap";
import { useRunView } from "../context/RunViewContext";
import {
  applyMapProgressOverrides,
  EMPTY_MAP_OVERRIDES,
  parseMapProgressOverrides,
  pruneMapProgressOverrides,
  type MapProgressOverrides,
} from "../lib/map-overrides";
import { MAP_STATUS_DEFINITIONS } from "../lib/map-status";

function initialPlannerOpen() {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(min-width: 760px)").matches;
}

function readOverrides(runId: string): MapProgressOverrides {
  if (typeof window === "undefined") return EMPTY_MAP_OVERRIDES;
  try {
    const raw = localStorage.getItem(`nuzlocke-companion.map-overrides.${runId}`);
    return raw ? parseMapProgressOverrides(JSON.parse(raw)) : EMPTY_MAP_OVERRIDES;
  } catch {
    return EMPTY_MAP_OVERRIDES;
  }
}

export function MapPage() {
  const { dataset, state, selectedRunId } = useRunView();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedFromUrl = searchParams.get("location") ?? undefined;
  const selectedLocationId = useMemo(
    () =>
      HGSS_MAIN_STORY_LOCATIONS.some((location) => location.id === selectedFromUrl)
        ? selectedFromUrl
        : undefined,
    [selectedFromUrl],
  );
  const [plannerOpen, setPlannerOpen] = useState(
    () => searchParams.get("planner") === "open" || initialPlannerOpen(),
  );
  const [overrides, setOverrides] = useState<MapProgressOverrides>(() =>
    readOverrides(selectedRunId),
  );
  const [fullscreen, setFullscreen] = useState(false);
  const workspaceRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const requested = searchParams.get("planner");
    if (requested === "open") setPlannerOpen(true);
    if (requested === "closed") setPlannerOpen(false);
  }, [searchParams]);

  useEffect(() => {
    setOverrides(readOverrides(selectedRunId));
  }, [selectedRunId]);

  useEffect(() => {
    setOverrides((current) => {
      const pruned = pruneMapProgressOverrides(state, current);
      if (JSON.stringify(pruned) !== JSON.stringify(current)) {
        if (pruned.badges.length || pruned.capabilities.length || pruned.milestones.length) {
          localStorage.setItem(
            `nuzlocke-companion.map-overrides.${selectedRunId}`,
            JSON.stringify(pruned),
          );
        } else {
          localStorage.removeItem(`nuzlocke-companion.map-overrides.${selectedRunId}`);
        }
        return pruned;
      }
      return current;
    });
  }, [state, selectedRunId]);

  useEffect(() => {
    function onFullscreenChange() {
      setFullscreen(document.fullscreenElement === workspaceRef.current);
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const effectiveState = useMemo(
    () => applyMapProgressOverrides(state, overrides),
    [state, overrides],
  );
  const overrideCount =
    overrides.badges.length + overrides.capabilities.length + overrides.milestones.length;

  function updateMapState(locationId: string | undefined, open = plannerOpen) {
    const next = new URLSearchParams(searchParams);
    if (locationId) next.set("location", locationId);
    else next.delete("location");
    next.set("planner", open ? "open" : "closed");
    setSearchParams(next, { replace: true });
  }

  function togglePlanner() {
    const nextOpen = !plannerOpen;
    setPlannerOpen(nextOpen);
    updateMapState(selectedLocationId, nextOpen);
  }

  function selectLocation(locationId: string | undefined) {
    updateMapState(locationId, plannerOpen);
  }

  function openPlannerForLocation(locationId: string) {
    setPlannerOpen(true);
    updateMapState(locationId, true);
  }

  function changeOverrides(next: MapProgressOverrides) {
    setOverrides(next);
    localStorage.setItem(`nuzlocke-companion.map-overrides.${selectedRunId}`, JSON.stringify(next));
  }

  function resetOverrides() {
    setOverrides(EMPTY_MAP_OVERRIDES);
    localStorage.removeItem(`nuzlocke-companion.map-overrides.${selectedRunId}`);
  }

  async function toggleFullscreen() {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    if (document.fullscreenElement === workspace) {
      await document.exitFullscreen();
    } else {
      await workspace.requestFullscreen();
    }
  }

  return (
    <div className="page-stack page-stack--tight map-page">
      <header className="page-heading map-page__heading">
        <div>
          <p className="eyebrow">HGSS encounter planning</p>
          <h1>Run Map</h1>
          <p>
            Select a marker to inspect its encounters. The planner shows what is available,
            completed, or still locked. If the recording session is ahead of the published site, use{" "}
            <strong>Overrides</strong> to temporarily mark badges, HMs, rods, or story milestones as
            completed in this browser only.
          </p>
        </div>
      </header>

      <section
        ref={workspaceRef}
        className={`map-workspace${plannerOpen ? " map-workspace--planner-open" : " map-workspace--planner-closed"}${fullscreen ? " map-workspace--fullscreen" : ""}`}
      >
        <div className="map-workspace-toolbar">
          {overrideCount ? (
            <span className="map-override-pill">
              {overrideCount} local override{overrideCount === 1 ? "" : "s"}
            </span>
          ) : null}
          <button type="button" onClick={() => void toggleFullscreen()}>
            {fullscreen ? "Exit fullscreen" : "Fullscreen"}
          </button>
        </div>
        <div className="map-stage">
          <div className="map-stage__canvas">
            <HgssRunMap
              state={effectiveState}
              selectedLocationId={selectedLocationId}
              onSelectLocation={selectLocation}
              onOpenPlanner={openPlannerForLocation}
            />
          </div>
          <div className="map-legend map-legend--below" aria-label="Map legend">
            {MAP_STATUS_DEFINITIONS.map((status) => (
              <span key={status.key} title={status.description}>
                <i className={`legend-dot map-status-color--${status.key}`} aria-hidden="true" />
                {status.label}
              </span>
            ))}
          </div>
        </div>
        <EncounterPlanner
          dataset={dataset}
          state={effectiveState}
          canonicalState={state}
          overrides={overrides}
          open={plannerOpen}
          selectedLocationId={selectedLocationId}
          onToggle={togglePlanner}
          onSelectLocation={selectLocation}
          onClearSelection={() => updateMapState(undefined, true)}
          onChangeOverrides={changeOverrides}
          onResetOverrides={resetOverrides}
        />
      </section>
    </div>
  );
}
