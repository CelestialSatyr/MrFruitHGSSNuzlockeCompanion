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

interface PokeApiPokemon {
  types: PokeApiTypeSlot[];
  past_types?: PokeApiPastTypes[];
}

const typeSet = new Set<string>(POKEMON_TYPES);
const promiseCache = new Map<number, Promise<readonly PokemonType[]>>();

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

export function getHgssPokemonTypes(speciesId: number): Promise<readonly PokemonType[]> {
  const existing = promiseCache.get(speciesId);
  if (existing) return existing;

  const request = fetch(`https://pokeapi.co/api/v2/pokemon/${speciesId}`)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Could not load Pokémon typing for #${speciesId} (${response.status}).`);
      }
      return resolveHgssPokemonTypes((await response.json()) as PokeApiPokemon);
    })
    .catch((error) => {
      promiseCache.delete(speciesId);
      throw error;
    });

  promiseCache.set(speciesId, request);
  return request;
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

export function clearHgssPokemonTypeCache(): void {
  promiseCache.clear();
}
