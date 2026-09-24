import {
  HGSS_MAIN_STORY_LOCATIONS,
  buildHgssEncounterPlanner,
  getHgssLocationAvailability,
  type HgssLocation,
  type HgssOpportunityState,
  type HgssProgressionCondition,
  type HgssProgressionState,
} from "@nuzlocke/hgss";
import type { RunDataset, RunEvent, RunState } from "@nuzlocke/core";
import { Link } from "react-router";
import { useMemo, useState } from "react";
import type { MapProgressOverrides } from "../lib/map-overrides";
import { MapOverridesPanel } from "./MapOverridesPanel";
import { deriveMapLocationStatus, mapStatusLegendLabel } from "../lib/map-status";

interface EncounterPlannerProps {
  dataset: RunDataset;
  state: RunState<HgssProgressionState>;
  canonicalState: RunState<HgssProgressionState>;
  overrides: MapProgressOverrides;
  open: boolean;
  selectedLocationId: string | undefined;
  onToggle(): void;
  onSelectLocation(locationId: string): void;
  onClearSelection(): void;
  onChangeOverrides(overrides: MapProgressOverrides): void;
  onResetOverrides(): void;
}

const BADGE_LABELS: Record<string, string> = {
  zephyr: "Zephyr Badge",
  hive: "Hive Badge",
  plain: "Plain Badge",
  fog: "Fog Badge",
  storm: "Storm Badge",
  mineral: "Mineral Badge",
  glacier: "Glacier Badge",
  rising: "Rising Badge",
};

const CAPABILITY_LABELS: Record<string, string> = {
  cut: "Cut",
  fly: "Fly",
  surf: "Surf",
  strength: "Strength",
  flash: "Flash",
  whirlpool: "Whirlpool",
  waterfall: "Waterfall",
  rockSmash: "Rock Smash",
  oldRod: "Old Rod",
  goodRod: "Good Rod",
  headbutt: "Headbutt",
};

const GYM_LOCATION_IDS: Record<string, string> = {
  "violet-gym": "violet-city",
  "azalea-gym": "azalea-town",
  "goldenrod-gym": "goldenrod-city",
  "ecruteak-gym": "ecruteak-city",
  "cianwood-gym": "cianwood-city",
  "olivine-gym": "olivine-city",
  "mahogany-gym": "mahogany-town",
  "blackthorn-gym": "blackthorn-city",
};

const MILESTONE_LABELS: Record<string, string> = {
  starterReceived: "Starter received",
  mysteryEggDeliveredToElm: "Mystery Egg delivered",
  mysteryEggReceived: "Mystery Egg received",
  slowpokeWellCleared: "Slowpoke Well cleared",
  ilexForestFarfetchdResolved: "Ilex Forest Farfetch'd resolved",
  sudowoodoCleared: "Sudowoodo cleared",
  burnedTowerVisited: "Burned Tower visited",
  secretMedicineObtained: "SecretPotion obtained",
  lighthouseMedicineDelivered: "Amphy treated",
  redGyaradosResolved: "Red Gyarados resolved",
  rocketHQCleared: "Rocket HQ cleared",
  radioTowerCleared: "Radio Tower cleared",
  blackthornGymDefeated: "Clair defeated",
  dragonsDenCleared: "Dragon's Den trial cleared",
  kimonoGirlsDefeated: "Kimono Girls defeated",
  towerLegendaryResolved: "Version legendary resolved",
  pokemonLeagueGateCleared: "League gate cleared",
  eliteFourDefeated: "Elite Four defeated",
};

function conditionLabel(condition: HgssProgressionCondition) {
  const label =
    condition.kind === "badge"
      ? BADGE_LABELS[condition.key]
      : condition.kind === "capability"
        ? CAPABILITY_LABELS[condition.key]
        : MILESTONE_LABELS[condition.key];
  return condition.value ? label : `Not ${label}`;
}

function availabilityLabel(entry: HgssOpportunityState) {
  return mapStatusLegendLabel(entry.availability);
}

function OpportunityRow({ entry }: { entry: HgssOpportunityState }) {
  return (
    <div className={`planner-opportunity planner-opportunity--${entry.availability}`}>
      <span className="planner-status-dot" aria-hidden="true" />
      <span>
        <strong>{entry.opportunity.label}</strong>
        <small>
          {availabilityLabel(entry)} · {entry.opportunity.kind}
        </small>
      </span>
      {entry.opportunity.versions?.length ? (
        <span
          className="version-chips"
          aria-label={`Versions: ${entry.opportunity.versions.join(", ")}`}
        >
          {entry.opportunity.versions.map((version) => (
            <b key={version}>{version === "heartgold" ? "HG" : "SS"}</b>
          ))}
        </span>
      ) : null}
    </div>
  );
}

export function EncounterPlanner({
  dataset,
  state,
  canonicalState,
  overrides,
  open,
  selectedLocationId,
  onToggle,
  onSelectLocation,
  onClearSelection,
  onChangeOverrides,
  onResetOverrides,
}: EncounterPlannerProps) {
  const [showFuture, setShowFuture] = useState(false);
  const [tab, setTab] = useState<"planner" | "overrides">("planner");
  const planner = useMemo(
    () => buildHgssEncounterPlanner(HGSS_MAIN_STORY_LOCATIONS, state),
    [state],
  );
  const available = planner.filter((entry) => entry.availability === "available");
  const completed = planner.filter((entry) =>
    ["caught", "failed", "skipped"].includes(entry.availability),
  );
  const rulesDependent = planner.filter((entry) => entry.availability === "rule-dependent");
  const locked = planner.filter((entry) => entry.availability === "locked");
  const selectedLocation = selectedLocationId
    ? HGSS_MAIN_STORY_LOCATIONS.find((location) => location.id === selectedLocationId)
    : undefined;
  const selectedEntries = selectedLocation
    ? planner.filter((entry) => entry.location.id === selectedLocation.id)
    : [];
  const overrideCount =
    overrides.badges.length + overrides.capabilities.length + overrides.milestones.length;

  return (
    <aside
      className={`encounter-planner${open ? " encounter-planner--open" : " encounter-planner--closed"}`}
      aria-label="Encounter planner"
    >
      <button className="planner-toggle" type="button" onClick={onToggle} aria-expanded={open}>
        <span aria-hidden="true">{open ? "›" : "‹"}</span>
        <span className="planner-toggle__copy">
          <strong>{available.length}</strong>
          <small>available</small>
        </span>
      </button>

      {open ? (
        <div className="planner-panel">
          <div className="planner-tabs" role="tablist" aria-label="Map tools">
            <button
              className={tab === "planner" ? "active" : ""}
              type="button"
              onClick={() => setTab("planner")}
            >
              Planner <span>{available.length}</span>
            </button>
            <button
              className={tab === "overrides" ? "active" : ""}
              type="button"
              onClick={() => setTab("overrides")}
            >
              Overrides {overrideCount ? <span>{overrideCount}</span> : null}
            </button>
          </div>

          {tab === "overrides" ? (
            <MapOverridesPanel
              canonicalState={canonicalState}
              overrides={overrides}
              onChange={onChangeOverrides}
              onReset={onResetOverrides}
            />
          ) : (
            <>
              <div className="planner-header">
                <div>
                  <p className="eyebrow">Encounter planner</p>
                  <h2>
                    {selectedLocation ? selectedLocation.name : `${available.length} available now`}
                  </h2>
                </div>
                {selectedLocation ? (
                  <button
                    className="icon-button"
                    type="button"
                    onClick={onClearSelection}
                    aria-label="Back to encounter list"
                  >
                    ←
                  </button>
                ) : null}
              </div>

              {selectedLocation ? (
                <LocationDetail
                  location={selectedLocation}
                  entries={selectedEntries}
                  state={state}
                  dataset={dataset}
                />
              ) : (
                <div className="planner-scroll">
                  <PlannerGroup
                    title="Available now"
                    count={available.length}
                    entries={available}
                    onSelectLocation={onSelectLocation}
                    empty="No unresolved encounters are currently reachable."
                  />
                  <PlannerGroup
                    title="Completed"
                    count={completed.length}
                    entries={completed}
                    onSelectLocation={onSelectLocation}
                    collapsed
                  />
                  <PlannerGroup
                    title="Special / rules-dependent"
                    count={rulesDependent.length}
                    entries={rulesDependent}
                    onSelectLocation={onSelectLocation}
                    collapsed
                  />

                  <label className="planner-future-toggle">
                    <input
                      type="checkbox"
                      checked={showFuture}
                      onChange={(event) => setShowFuture(event.target.checked)}
                    />
                    <span>Show future locked locations</span>
                  </label>
                  {showFuture ? (
                    <PlannerGroup
                      title="Locked"
                      count={locked.length}
                      entries={locked}
                      onSelectLocation={onSelectLocation}
                    />
                  ) : null}
                </div>
              )}
            </>
          )}
        </div>
      ) : null}
    </aside>
  );
}

function PlannerGroup({
  title,
  count,
  entries,
  onSelectLocation,
  collapsed = false,
  empty,
}: {
  title: string;
  count: number;
  entries: HgssOpportunityState[];
  onSelectLocation(locationId: string): void;
  collapsed?: boolean;
  empty?: string;
}) {
  const [expanded, setExpanded] = useState(!collapsed);
  const unique = new Map<string, HgssOpportunityState>();
  for (const entry of entries)
    if (!unique.has(entry.location.id)) unique.set(entry.location.id, entry);

  return (
    <section className="planner-group">
      <button
        className="planner-group__heading"
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
      >
        <span>{title}</span>
        <span>
          {count} {expanded ? "⌃" : "⌄"}
        </span>
      </button>
      {expanded ? (
        <div className="planner-group__items">
          {unique.size ? (
            [...unique.values()].map((entry) => (
              <button
                key={entry.location.id}
                className={`planner-location planner-location--${entry.availability}`}
                type="button"
                onClick={() => onSelectLocation(entry.location.id)}
              >
                <span className="planner-status-dot" aria-hidden="true" />
                <span>
                  <strong>{entry.location.name}</strong>
                  <small>{availabilityLabel(entry)}</small>
                </span>
                <span aria-hidden="true">›</span>
              </button>
            ))
          ) : (
            <p className="planner-empty">{empty ?? "Nothing here yet."}</p>
          )}
        </div>
      ) : null}
    </section>
  );
}

function LocationDetail({
  location,
  entries,
  state,
  dataset,
}: {
  location: HgssLocation;
  entries: HgssOpportunityState[];
  state: RunState<HgssProgressionState>;
  dataset: RunDataset;
}) {
  const overall = deriveMapLocationStatus(location, entries, state);
  const locationAvailability = getHgssLocationAvailability(location, state.game);
  const visibleEventIds = new Set(state.processedEventIds);
  const locationEvents = dataset.events.filter(
    (event) => visibleEventIds.has(event.id) && eventLocationId(event) === location.id,
  );

  return (
    <div className="planner-scroll planner-detail">
      <div className={`planner-detail__status planner-detail__status--${overall}`}>
        <span className="planner-status-dot" aria-hidden="true" />
        <strong>{mapStatusLegendLabel(overall)}</strong>
      </div>
      <dl className="planner-facts">
        <div>
          <dt>Region</dt>
          <dd>{location.region === "johto" ? "Johto" : "Kanto / League approach"}</dd>
        </div>
        <div>
          <dt>Type</dt>
          <dd>{location.kind}</dd>
        </div>
        <div>
          <dt>Access</dt>
          <dd>{locationAvailability === "available" ? "Reachable" : "Locked"}</dd>
        </div>
      </dl>

      {entries.length ? (
        <section>
          <h3>Encounter opportunities</h3>
          <div className="planner-opportunity-list">
            {entries.map((entry) => (
              <OpportunityRow key={entry.opportunity.id} entry={entry} />
            ))}
          </div>
        </section>
      ) : (
        <p className="planner-note">
          This is a navigation/story location and does not currently add an encounter to the
          checklist.
        </p>
      )}

      {locationEvents.length ? (
        <section>
          <h3>Run history here</h3>
          <div className="planner-history-list">
            {locationEvents.map((event) => (
              <Link key={event.id} to={`/events/${event.id}`} className="planner-history-link">
                <span>{event.title ?? event.type.replaceAll("-", " ")}</span>
                <small>
                  Episode{" "}
                  {dataset.episodes.find((episode) => episode.id === event.episodeId)?.number ??
                    "?"}{" "}
                  · View event →
                </small>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {location.availability ? (
        <section>
          <h3>Access requirements</h3>
          <div className="requirement-groups">
            {location.availability.anyOf.map((group, index) => (
              <div className="requirement-group" key={index}>
                {group.allOf.map((condition) => (
                  <span key={`${condition.kind}-${condition.key}`}>
                    {conditionLabel(condition)}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </section>
      ) : (
        <p className="planner-note">Reachable from the beginning of the main story.</p>
      )}
    </div>
  );
}

function eventLocationId(event: RunEvent): string | undefined {
  switch (event.type) {
    case "encounter":
    case "pokemon-death":
    case "custom":
      return event.locationId;
    case "gym-battle":
      return GYM_LOCATION_IDS[event.gymId];
    default:
      return undefined;
  }
}
