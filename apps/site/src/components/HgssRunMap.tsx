import {
  HGSS_MAIN_STORY_LOCATIONS,
  buildHgssEncounterPlanner,
  type HgssLocation,
  type HgssOpportunityState,
  type HgssProgressionState,
} from "@nuzlocke/hgss";
import type { RunState } from "@nuzlocke/core";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { deriveMapLocationStatus, mapStatusLabel, type MapLocationStatus } from "../lib/map-status";
import "../styles/map-zoom-labels.css";

interface HgssRunMapProps {
  state: RunState<HgssProgressionState>;
  selectedLocationId: string | undefined;
  onSelectLocation(locationId: string | undefined): void;
  onOpenPlanner(locationId: string): void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;
const LABEL_HIDE_ZOOM = 3;
const JOHTO_MAP_URL = `${import.meta.env.BASE_URL}JohtoMap.png`;
const JOHTO_MAP_WIDTH = 1961;
const JOHTO_MAP_HEIGHT = 1316;
const JOHTO_MAP_ASPECT = JOHTO_MAP_WIDTH / JOHTO_MAP_HEIGHT;

const MAJOR_LABEL_IDS = new Set([
  "new-bark-town",
  "cherrygrove-city",
  "violet-city",
  "azalea-town",
  "goldenrod-city",
  "ecruteak-city",
  "olivine-city",
  "cianwood-city",
  "mahogany-town",
  "blackthorn-city",
  "indigo-plateau",
]);

function markerShape(kind: HgssLocation["kind"]): "circle" | "square" | "diamond" {
  if (kind === "city" || kind === "town") return "square";
  if (kind === "cave" || kind === "building") return "diamond";
  return "circle";
}

function kindLabel(kind: HgssLocation["kind"]): string {
  switch (kind) {
    case "city":
      return "City";
    case "town":
      return "Town";
    case "route":
      return "Route";
    case "cave":
      return "Cave";
    case "forest":
      return "Forest";
    case "building":
      return "Building";
    case "landmark":
      return "Landmark";
    case "other":
      return "Location";
  }
}

function locationSummary(location: HgssLocation, entries: readonly HgssOpportunityState[]): string {
  const kinds = [...new Set(entries.map((entry) => entry.opportunity.kind))];
  const readableKinds = kinds
    .map((kind) => (kind === "static" ? "static encounter" : kind))
    .join(", ");

  if (!entries.length) {
    return `${kindLabel(location.kind)} used for route planning and story progression.`;
  }

  if (readableKinds) {
    return `${kindLabel(location.kind)} with ${readableKinds} ${kinds.length === 1 ? "opportunity" : "opportunities"}.`;
  }

  return `${kindLabel(location.kind)} with ${entries.length} tracked encounter opportunities.`;
}

function StatusMarker({
  location,
  status,
  selected,
  onSelect,
}: {
  location: HgssLocation;
  status: MapLocationStatus;
  selected: boolean;
  onSelect(): void;
}) {
  const showLabel = selected || MAJOR_LABEL_IDS.has(location.id);
  const shape = markerShape(location.kind);

  return (
    <button
      type="button"
      className={`map-node map-node--${status} map-node--${shape}${selected ? " map-node--selected" : ""}`}
      style={{ left: `${location.map.anchor.x * 100}%`, top: `${location.map.anchor.y * 100}%` }}
      aria-label={`${location.name}. ${mapStatusLabel(status)}.`}
      aria-pressed={selected}
      title={`${location.name} — ${mapStatusLabel(status)}`}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
    >
      <span className="map-node__pin" aria-hidden="true">
        {status === "lost" || status === "failed" ? (
          <span className="map-node__symbol map-node__symbol--cross" />
        ) : status === "available" ? (
          <span className="map-node__symbol map-node__symbol--alert">!</span>
        ) : null}
      </span>
      {showLabel ? <span className="map-node__label">{location.name}</span> : null}
    </button>
  );
}

function LocationPeek({
  location,
  status,
  entries,
  onOpenPlanner,
}: {
  location: HgssLocation;
  status: MapLocationStatus;
  entries: readonly HgssOpportunityState[];
  onOpenPlanner(): void;
}) {
  const available = entries.filter((entry) => entry.availability === "available").length;
  const resolved = entries.filter((entry) =>
    ["caught", "failed", "skipped"].includes(entry.availability),
  ).length;

  return (
    <aside
      className="map-location-peek"
      aria-live="polite"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="map-location-peek__heading">
        <div>
          <span className={`map-location-peek__status map-location-peek__status--${status}`}>
            {mapStatusLabel(status)}
          </span>
          <h3>{location.name}</h3>
        </div>
        <span className="map-location-peek__kind">{kindLabel(location.kind)}</span>
      </div>

      <p>{locationSummary(location, entries)}</p>

      <div className="map-location-peek__counts">
        <span>
          <strong>{available}</strong> available now
        </span>
        <span>
          <strong>{resolved}</strong> resolved
        </span>
        <span>
          <strong>{entries.length}</strong> tracked
        </span>
      </div>

      {entries.length ? (
        <div className="map-location-peek__opportunities">
          {entries.slice(0, 4).map((entry) => (
            <span key={entry.opportunity.id}>
              <i
                className={`map-location-peek__dot map-location-peek__dot--${entry.availability}`}
                aria-hidden="true"
              />
              {entry.opportunity.label}
            </span>
          ))}
        </div>
      ) : null}

      <button type="button" onClick={onOpenPlanner}>
        Open in encounter planner
      </button>
    </aside>
  );
}

export function HgssRunMap({
  state,
  selectedLocationId,
  onSelectLocation,
  onOpenPlanner,
}: HgssRunMapProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{
    pointerId: number;
    x: number;
    y: number;
    startX: number;
    startY: number;
  } | null>(null);
  const explorerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [mapFrame, setMapFrame] = useState({ width: 0, height: 0 });

  const planner = buildHgssEncounterPlanner(HGSS_MAIN_STORY_LOCATIONS, state);
  const byLocation = new Map<string, HgssOpportunityState[]>();

  for (const entry of planner) {
    const list = byLocation.get(entry.location.id) ?? [];
    list.push(entry);
    byLocation.set(entry.location.id, list);
  }

  const selectedLocation = selectedLocationId
    ? HGSS_MAIN_STORY_LOCATIONS.find((location) => location.id === selectedLocationId)
    : undefined;
  const selectedEntries = selectedLocation ? (byLocation.get(selectedLocation.id) ?? []) : [];
  const selectedStatus = selectedLocation
    ? deriveMapLocationStatus(selectedLocation, selectedEntries, state)
    : undefined;

  function clampZoom(value: number) {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
  }

  function updateZoom(nextValue: number) {
    const next = clampZoom(nextValue);
    setZoom(next);
    if (next === MIN_ZOOM) setPan({ x: 0, y: 0 });
  }

  function changeZoom(delta: number) {
    updateZoom(zoom + delta);
  }

  function resetView() {
    setZoom(MIN_ZOOM);
    setPan({ x: 0, y: 0 });
  }

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const resize = () => {
      const { width, height } = viewport.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;

      const fitWidth = Math.min(width, height * JOHTO_MAP_ASPECT);
      setMapFrame({ width: fitWidth, height: fitWidth / JOHTO_MAP_ASPECT });
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const explorer = explorerRef.current;
    if (!explorer) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setZoom((current) => {
        const next = clampZoom(current + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP));
        if (next === MIN_ZOOM) setPan({ x: 0, y: 0 });
        return next;
      });
    };

    explorer.addEventListener("wheel", handleWheel, { passive: false, capture: true });
    return () => explorer.removeEventListener("wheel", handleWheel, true);
  }, []);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    onSelectLocation(undefined);

    if (zoom <= MIN_ZOOM || event.button !== 0) return;

    drag.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      startX: pan.x,
      startY: pan.y,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;

    event.preventDefault();
    setPan({
      x: current.startX + event.clientX - current.x,
      y: current.startY + event.clientY - current.y,
    });
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointerId === event.pointerId) drag.current = null;
  }

  return (
    <div ref={explorerRef} className="map-explorer">
      <div className="map-controls" aria-label="Map controls">
        <button type="button" onClick={() => changeZoom(ZOOM_STEP)} aria-label="Zoom in">
          +
        </button>
        <button type="button" onClick={() => changeZoom(-ZOOM_STEP)} aria-label="Zoom out">
          −
        </button>
        <button type="button" onClick={resetView}>
          Reset
        </button>
        <span>{Math.round(zoom * 100)}%</span>
      </div>

      <div
        ref={viewportRef}
        className={zoom > MIN_ZOOM ? "map-viewport map-viewport--pannable" : "map-viewport"}
        aria-label="Interactive Johto encounter map. Use the mouse wheel to zoom, drag while zoomed to pan, and select a marker for details."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div
          className="map-canvas-frame"
          style={
            mapFrame.width
              ? { width: `${mapFrame.width}px`, height: `${mapFrame.height}px` }
              : undefined
          }
        >
          <div
            className="map-canvas"
            style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})` }}
          >
            <img
              className="hgss-map-art"
              src={JOHTO_MAP_URL}
              alt=""
              aria-hidden="true"
              draggable={false}
            />
            <div className="map-map-vignette" aria-hidden="true" />
            <div
              className={`map-nodes${zoom > LABEL_HIDE_ZOOM ? " map-nodes--labels-hidden" : ""}`}
              aria-label="Johto locations"
            >
              {HGSS_MAIN_STORY_LOCATIONS.map((location) => (
                <StatusMarker
                  key={location.id}
                  location={location}
                  status={deriveMapLocationStatus(
                    location,
                    byLocation.get(location.id) ?? [],
                    state,
                  )}
                  selected={selectedLocationId === location.id}
                  onSelect={() => onSelectLocation(location.id)}
                />
              ))}
            </div>
          </div>
        </div>

        {selectedLocation && selectedStatus ? (
          <LocationPeek
            location={selectedLocation}
            status={selectedStatus}
            entries={selectedEntries}
            onOpenPlanner={() => onOpenPlanner(selectedLocation.id)}
          />
        ) : (
          <div className="map-hint" aria-hidden="true">
            Select a location for details
          </div>
        )}
      </div>
    </div>
  );
}
