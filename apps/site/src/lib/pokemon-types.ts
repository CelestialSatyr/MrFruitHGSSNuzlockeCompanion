export interface PokemonTypeInfo {
  id: string;
  label: string;
}

const HGSS_GENERATION = 4;

const BUILTIN_TYPES: Readonly<Record<number, readonly string[]>> = {
  16: ["normal", "flying"],
  92: ["ghost", "poison"],
  155: ["fire"],
  156: ["fire"],
  158: ["water"],
  161: ["normal"],
  179: ["electric"],
};

const GENERATION_NUMBERS: Readonly<Record<string, number>> = {
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

const memoryCache = new Map<number, PokemonTypeInfo[]>();
const pending = new Map<number, Promise<PokemonTypeInfo[]>>();

interface PokeApiPokemonType {
  slot?: number;
  type?: { name?: string };
}

interface PokeApiPastType {
  generation?: { name?: string };
  types?: PokeApiPokemonType[];
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function mapTypes(types: readonly string[]): PokemonTypeInfo[] {
  return types.map((id) => ({ id, label: titleCase(id) }));
}

function normalizeApiTypes(types: PokeApiPokemonType[] | undefined): PokemonTypeInfo[] {
  return (types ?? [])
    .filter(
      (entry): entry is { slot: number; type: { name: string } } =>
        typeof entry.slot === "number" && typeof entry.type?.name === "string",
    )
    .sort((left, right) => left.slot - right.slot)
    .map((entry) => ({ id: entry.type.name, label: titleCase(entry.type.name) }));
}

function hgssTypesFromPayload(payload: {
  types?: PokeApiPokemonType[];
  past_types?: PokeApiPastType[];
}): PokemonTypeInfo[] {
  const historical = (payload.past_types ?? [])
    .map((entry) => ({
      generation: GENERATION_NUMBERS[entry.generation?.name ?? ""] ?? Number.MAX_SAFE_INTEGER,
      types: entry.types,
    }))
    .filter((entry) => entry.generation >= HGSS_GENERATION)
    .sort((left, right) => left.generation - right.generation)[0];

  return normalizeApiTypes(historical?.types ?? payload.types);
}

export function getCachedPokemonTypes(speciesId: number): PokemonTypeInfo[] {
  const memory = memoryCache.get(speciesId);
  if (memory) return memory;

  const builtin = BUILTIN_TYPES[speciesId];
  if (builtin) {
    const value = mapTypes(builtin);
    memoryCache.set(speciesId, value);
    return value;
  }

  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(`nuzlocke-companion.hgss-pokemon-types.v1.${speciesId}`);
      if (raw) {
        const value = JSON.parse(raw) as PokemonTypeInfo[];
        if (Array.isArray(value) && value.length) {
          memoryCache.set(speciesId, value);
          return value;
        }
      }
    } catch {
      // A corrupt cache should never break the companion.
    }
  }

  return [];
}

export async function loadPokemonTypes(speciesId: number): Promise<PokemonTypeInfo[]> {
  const cached = getCachedPokemonTypes(speciesId);
  if (cached.length) return cached;

  const existing = pending.get(speciesId);
  if (existing) return existing;

  const request = fetch(`https://pokeapi.co/api/v2/pokemon/${speciesId}`)
    .then(async (response) => {
      if (!response.ok) throw new Error(`PokéAPI type lookup failed (${response.status}).`);
      const payload = (await response.json()) as {
        types?: PokeApiPokemonType[];
        past_types?: PokeApiPastType[];
      };
      const value = hgssTypesFromPayload(payload);
      if (value.length) {
        memoryCache.set(speciesId, value);
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(
              `nuzlocke-companion.hgss-pokemon-types.v1.${speciesId}`,
              JSON.stringify(value),
            );
          } catch {
            // Caching is optional.
          }
        }
      }
      return value;
    })
    .catch(() => [] as PokemonTypeInfo[])
    .finally(() => pending.delete(speciesId));

  pending.set(speciesId, request);
  return request;
}
