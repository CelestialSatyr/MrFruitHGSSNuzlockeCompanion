import type { PokemonState, RunDataset, RunEvent } from "@nuzlocke/core";
import { HGSS_MAIN_STORY_LOCATIONS } from "@nuzlocke/hgss";
import { titleCase } from "./format";

const HGSS_LOCATION_NAMES = new Map(
  HGSS_MAIN_STORY_LOCATIONS.map((location) => [location.id, location.name] as const),
);

export function getHgssLocationName(locationId: string | undefined): string | undefined {
  if (!locationId) return undefined;
  return HGSS_LOCATION_NAMES.get(locationId) ?? titleCase(locationId);
}

export function getEventLocationId(event: RunEvent): string | undefined {
  switch (event.type) {
    case "encounter":
      return event.locationId;
    case "pokemon-death":
      return event.locationId;
    case "custom":
      return event.locationId;
    default:
      return undefined;
  }
}

export function getEventLocationName(event: RunEvent): string | undefined {
  return getHgssLocationName(getEventLocationId(event));
}

export function getPokemonCatchEvent(
  dataset: RunDataset,
  pokemon: PokemonState,
): Extract<RunEvent, { type: "encounter" }> | undefined {
  const event = dataset.events.find((entry) => entry.id === pokemon.createdByEventId);
  return event?.type === "encounter" ? event : undefined;
}

export function getPokemonCatchLocationName(
  dataset: RunDataset,
  pokemon: PokemonState,
): string | undefined {
  return getHgssLocationName(getPokemonCatchEvent(dataset, pokemon)?.locationId);
}
