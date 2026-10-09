import { POKEMON_TYPES, type PokemonType } from "@nuzlocke/core";

interface NamedResource {
  name: string;
}

interface PokeApiTypeSlot {
  slot: number;
  type: NamedResource;
}

interface PokeApiPastTypes {
  generation: NamedResource;
  types: PokeApiTypeSlot[];
}

interface PokeApiStatSlot {
  base_stat: number;
  stat: NamedResource;
}

interface PokeApiPokemon {
  types: PokeApiTypeSlot[];
  past_types?: PokeApiPastTypes[];
  stats?: PokeApiStatSlot[];
}

export interface HgssPokemonPlannerData {
  types: readonly PokemonType[];
  baseStatTotal: number;
}

const typeSet = new Set<string>(POKEMON_TYPES);
const payloadPromiseCache = new Map<number, Promise<PokeApiPokemon>>();

// A small set of pre-Gen-VI/VII BST values differs from modern PokéAPI data.
// HGSS uses Generation IV mechanics, whose base stats match these historical values.
const HGSS_BASE_STAT_TOTAL_OVERRIDES: Readonly<Record<number, number>> = {
  12: 385,
  15: 385,
  18: 469,
  25: 300,
  26: 475,
  31: 495,
  34: 495,
  36: 473,
  40: 425,
  45: 480,
  62: 500,
  65: 490,
  71: 480,
  76: 485,
  181: 500,
  182: 480,
  184: 410,
  189: 450,
  267: 385,
  295: 480,
  398: 475,
  407: 505,
};

const GENERATION_NUMBER: Record<string, number> = {
  "generation-i": 1,
  "generation-ii": 2,
  "generation-iii": 3,
  "generation-iv": 4,
  "generation-v": 5,
  "generation-vi": 6,
  "generation-vii": 7,
  "generation-viii": 8,
  "generation-ix": 9,
};

function normaliseTypes(entries: readonly PokeApiTypeSlot[]): PokemonType[] {
  return [...entries]
    .sort((a, b) => a.slot - b.slot)
    .map((entry) => entry.type.name.toLowerCase())
    .filter((name): name is PokemonType => typeSet.has(name));
}

/**
 * PokeAPI's `past_types.generation` means "the last generation in which this
 * historical type set applied". For HGSS we need generation IV mechanics.
 * The earliest past-type record whose last generation is >= IV therefore
 * contains the correct HGSS types. If none exists, the current type set was
 * already in effect in Gen IV.
 */
export function resolveHgssPokemonTypes(payload: PokeApiPokemon): readonly PokemonType[] {
  const historical = (payload.past_types ?? [])
    .map((entry) => ({
      lastGeneration: GENERATION_NUMBER[entry.generation.name] ?? Number.POSITIVE_INFINITY,
      types: normaliseTypes(entry.types),
    }))
    .filter((entry) => entry.lastGeneration >= 4 && entry.types.length > 0)
    .sort((a, b) => a.lastGeneration - b.lastGeneration)[0];

  const resolved = historical?.types ?? normaliseTypes(payload.types);
  if (!resolved.length) throw new Error("PokéAPI returned no recognised typing data.");
  return resolved;
}

export function resolvePokemonBaseStatTotal(payload: PokeApiPokemon): number {
  const stats = payload.stats ?? [];
  const total = stats.reduce((sum, entry) => sum + entry.base_stat, 0);
  if (!Number.isFinite(total) || total <= 0) {
    throw new Error("PokéAPI returned no recognised base-stat data.");
  }
  return total;
}

export function resolveHgssPokemonBaseStatTotal(
  speciesId: number,
  payload: PokeApiPokemon,
): number {
  return HGSS_BASE_STAT_TOTAL_OVERRIDES[speciesId] ?? resolvePokemonBaseStatTotal(payload);
}

function getPokemonPayload(speciesId: number): Promise<PokeApiPokemon> {
  const existing = payloadPromiseCache.get(speciesId);
  if (existing) return existing;

  const request = fetch(`https://pokeapi.co/api/v2/pokemon/${speciesId}`)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Could not load Pokémon data for #${speciesId} (${response.status}).`);
      }
      return (await response.json()) as PokeApiPokemon;
    })
    .catch((error) => {
      payloadPromiseCache.delete(speciesId);
      throw error;
    });

  payloadPromiseCache.set(speciesId, request);
  return request;
}

export function getHgssPokemonTypes(speciesId: number): Promise<readonly PokemonType[]> {
  return getPokemonPayload(speciesId).then(resolveHgssPokemonTypes);
}

export function getPokemonBaseStatTotal(speciesId: number): Promise<number> {
  return getPokemonPayload(speciesId).then((payload) =>
    resolveHgssPokemonBaseStatTotal(speciesId, payload),
  );
}

export async function getHgssPokemonPlannerData(
  speciesId: number,
): Promise<HgssPokemonPlannerData> {
  const payload = await getPokemonPayload(speciesId);
  return {
    types: resolveHgssPokemonTypes(payload),
    baseStatTotal: resolveHgssPokemonBaseStatTotal(speciesId, payload),
  };
}

export async function getHgssPokemonTypeMap(
  speciesIds: readonly number[],
): Promise<Map<number, readonly PokemonType[]>> {
  const unique = [...new Set(speciesIds.filter((id) => Number.isFinite(id) && id > 0))];
  const entries = await Promise.all(
    unique.map(async (id) => [id, await getHgssPokemonTypes(id)] as const),
  );
  return new Map(entries);
}

export async function getHgssPokemonPlannerDataMap(
  speciesIds: readonly number[],
): Promise<Map<number, HgssPokemonPlannerData>> {
  const unique = [...new Set(speciesIds.filter((id) => Number.isFinite(id) && id > 0))];
  const entries = await Promise.all(
    unique.map(async (id) => [id, await getHgssPokemonPlannerData(id)] as const),
  );
  return new Map(entries);
}

export function clearHgssPokemonTypeCache(): void {
  payloadPromiseCache.clear();
}
