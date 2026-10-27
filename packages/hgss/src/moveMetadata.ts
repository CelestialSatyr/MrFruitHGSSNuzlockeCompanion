import { POKEMON_TYPES, type PokemonType } from "@nuzlocke/core";

export type HgssMoveDamageClass = "physical" | "special" | "status";

interface NamedResource {
  name: string;
}

interface PokeApiMoveMeta {
  min_hits?: number | null;
  max_hits?: number | null;
  drain?: number | null;
}

interface PokeApiMove {
  name: string;
  power: number | null;
  type: NamedResource;
  damage_class: NamedResource;
  meta?: PokeApiMoveMeta | null;
}

export interface HgssMovePlannerData {
  id: string;
  type?: PokemonType;
  damageClass: HgssMoveDamageClass;
  power?: number;
  minHits?: number;
  maxHits?: number;
  /** Negative values represent recoil in PokéAPI's move metadata. */
  drain?: number;
}

const movePromiseCache = new Map<string, Promise<HgssMovePlannerData>>();
const typeSet = new Set<string>(POKEMON_TYPES);

export function normaliseMoveId(value: string): string {
  return value.trim().toLowerCase().replaceAll("_", "-").replaceAll(" ", "-");
}

function parseMove(id: string, payload: PokeApiMove): HgssMovePlannerData {
  const typeName = payload.type.name.toLowerCase();
  const damageClass = payload.damage_class.name.toLowerCase();
  if (damageClass !== "physical" && damageClass !== "special" && damageClass !== "status") {
    throw new Error(`PokéAPI returned an unsupported damage class for ${id}.`);
  }

  return {
    id,
    ...(typeSet.has(typeName) ? { type: typeName as PokemonType } : {}),
    damageClass,
    ...(typeof payload.power === "number" && payload.power > 0 ? { power: payload.power } : {}),
    ...(typeof payload.meta?.min_hits === "number" ? { minHits: payload.meta.min_hits } : {}),
    ...(typeof payload.meta?.max_hits === "number" ? { maxHits: payload.meta.max_hits } : {}),
    ...(typeof payload.meta?.drain === "number" ? { drain: payload.meta.drain } : {}),
  };
}

export function getHgssMovePlannerData(moveId: string): Promise<HgssMovePlannerData> {
  const id = normaliseMoveId(moveId);
  const existing = movePromiseCache.get(id);
  if (existing) return existing;

  const request = fetch(`https://pokeapi.co/api/v2/move/${encodeURIComponent(id)}`)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Could not load move data for ${id} (${response.status}).`);
      }
      return parseMove(id, (await response.json()) as PokeApiMove);
    })
    .catch((error) => {
      movePromiseCache.delete(id);
      throw error;
    });

  movePromiseCache.set(id, request);
  return request;
}

/**
 * Move data is optional enhancement data. Invalid legacy move IDs or a single
 * failed API request must not make the Party Planner unusable, so unresolved
 * entries are omitted and their dependent ability checks fall back to neutral.
 */
export async function getHgssMovePlannerDataMap(
  moveIds: readonly string[],
): Promise<Map<string, HgssMovePlannerData>> {
  const unique = [...new Set(moveIds.map(normaliseMoveId).filter(Boolean))];
  const settled = await Promise.allSettled(
    unique.map(async (id) => [id, await getHgssMovePlannerData(id)] as const),
  );
  return new Map(settled.flatMap((entry) => (entry.status === "fulfilled" ? [entry.value] : [])));
}

export function clearHgssMovePlannerDataCache(): void {
  movePromiseCache.clear();
}
