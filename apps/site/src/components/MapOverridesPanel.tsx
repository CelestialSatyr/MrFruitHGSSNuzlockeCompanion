import type { ReactNode } from "react";
import {
  HGSS_BADGE_KEYS,
  HGSS_CAPABILITY_KEYS,
  HGSS_MILESTONE_KEYS,
  type HgssBadgeKey,
  type HgssCapabilityKey,
  type HgssMilestoneKey,
  type HgssProgressionState,
} from "@nuzlocke/hgss";
import type { RunState } from "@nuzlocke/core";
import type { MapProgressOverrides } from "../lib/map-overrides";

interface MapOverridesPanelProps {
  canonicalState: RunState<HgssProgressionState>;
  overrides: MapProgressOverrides;
  onChange(overrides: MapProgressOverrides): void;
  onReset(): void;
}

const BADGE_LABELS: Record<HgssBadgeKey, string> = {
  zephyr: "Zephyr",
  hive: "Hive",
  plain: "Plain",
  fog: "Fog",
  storm: "Storm",
  mineral: "Mineral",
  glacier: "Glacier",
  rising: "Rising",
};

const CAPABILITY_LABELS: Record<HgssCapabilityKey, string> = {
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

const MILESTONE_LABELS: Record<HgssMilestoneKey, string> = {
  starterReceived: "Starter received",
  mysteryEggDeliveredToElm: "Mystery Egg delivered to Elm",
  mysteryEggReceived: "Mystery Egg received",
  slowpokeWellCleared: "Slowpoke Well cleared",
  ilexForestFarfetchdResolved: "Ilex Forest Farfetch'd resolved",
  sudowoodoCleared: "Sudowoodo cleared",
  burnedTowerVisited: "Burned Tower visited",
  secretMedicineObtained: "SecretPotion obtained",
  lighthouseMedicineDelivered: "Lighthouse medicine delivered",
  redGyaradosResolved: "Red Gyarados resolved",
  rocketHQCleared: "Rocket HQ cleared",
  radioTowerCleared: "Radio Tower cleared",
  blackthornGymDefeated: "Clair defeated",
  dragonsDenCleared: "Dragon's Den cleared",
  kimonoGirlsDefeated: "Kimono Girls defeated",
  towerLegendaryResolved: "Version legendary resolved",
  pokemonLeagueGateCleared: "Pokémon League gate cleared",
  eliteFourDefeated: "Elite Four defeated",
};

export function MapOverridesPanel({
  canonicalState,
  overrides,
  onChange,
  onReset,
}: MapOverridesPanelProps) {
  const count =
    overrides.badges.length + overrides.capabilities.length + overrides.milestones.length;

  function toggleBadge(key: HgssBadgeKey, enabled: boolean) {
    const badges = enabled
      ? [...new Set([...overrides.badges, key])]
      : overrides.badges.filter((entry) => entry !== key);
    onChange({ ...overrides, badges });
  }

  function toggleCapability(key: HgssCapabilityKey, enabled: boolean) {
    const capabilities = enabled
      ? [...new Set([...overrides.capabilities, key])]
      : overrides.capabilities.filter((entry) => entry !== key);
    onChange({ ...overrides, capabilities });
  }

  function toggleMilestone(key: HgssMilestoneKey, enabled: boolean) {
    const milestones = enabled
      ? [...new Set([...overrides.milestones, key])]
      : overrides.milestones.filter((entry) => entry !== key);
    onChange({ ...overrides, milestones });
  }

  return (
    <div className="planner-scroll map-overrides-panel">
      <div className="map-overrides-intro">
        <strong>Recording-session overrides</strong>
        <p>
          Recording ahead of the website? Tick the badges, HMs, rods or story steps you've already
          reached and the map will immediately show the encounters that have opened up. These
          changes stay on this device and won't change the run history on the site.
        </p>
        <div>
          <span>
            {count} active override{count === 1 ? "" : "s"}
          </span>
          <button type="button" onClick={onReset} disabled={count === 0}>
            Reset overrides
          </button>
        </div>
      </div>

      <OverrideGroup title="Badges">
        {HGSS_BADGE_KEYS.map((key) => {
          const canonical = canonicalState.game.badges[key];
          const checked = canonical || overrides.badges.includes(key);
          return (
            <OverrideToggle
              key={key}
              label={`${BADGE_LABELS[key]} Badge`}
              checked={checked}
              canonical={canonical}
              onChange={(value) => toggleBadge(key, value)}
            />
          );
        })}
      </OverrideGroup>

      <OverrideGroup title="Field capabilities">
        {HGSS_CAPABILITY_KEYS.map((key) => {
          const canonical = canonicalState.game.capabilities[key];
          const checked = canonical || overrides.capabilities.includes(key);
          return (
            <OverrideToggle
              key={key}
              label={CAPABILITY_LABELS[key]}
              checked={checked}
              canonical={canonical}
              onChange={(value) => toggleCapability(key, value)}
            />
          );
        })}
      </OverrideGroup>

      <OverrideGroup title="Story milestones">
        {HGSS_MILESTONE_KEYS.map((key) => {
          const canonical = canonicalState.game.milestones[key];
          const checked = canonical || overrides.milestones.includes(key);
          return (
            <OverrideToggle
              key={key}
              label={MILESTONE_LABELS[key]}
              checked={checked}
              canonical={canonical}
              onChange={(value) => toggleMilestone(key, value)}
            />
          );
        })}
      </OverrideGroup>
    </div>
  );
}

function OverrideGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="override-group">
      <h3>{title}</h3>
      <div className="override-grid">{children}</div>
    </section>
  );
}

function OverrideToggle({
  label,
  checked,
  canonical,
  onChange,
}: {
  label: string;
  checked: boolean;
  canonical: boolean;
  onChange(value: boolean): void;
}) {
  return (
    <label className={`override-toggle${canonical ? " override-toggle--canonical" : ""}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={canonical}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <strong>{label}</strong>
        <small>
          {canonical ? "Recorded in run data" : checked ? "Local override" : "Not unlocked"}
        </small>
      </span>
    </label>
  );
}
