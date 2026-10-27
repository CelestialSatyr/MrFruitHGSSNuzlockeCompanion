const memoryCache = new Map<string, string>();
const pending = new Map<string, Promise<string | undefined>>();
const STORAGE_PREFIX = "nuzlocke-companion.ability-effect.v1.";

interface PokeApiAbilityEffectEntry {
  effect?: string;
  short_effect?: string;
  language?: { name?: string };
}

interface PokeApiAbilityPayload {
  effect_entries?: PokeApiAbilityEffectEntry[];
}

function normaliseAbilityId(value: string): string {
  return value.trim().toLowerCase().replaceAll("_", "-").replaceAll(" ", "-");
}

function cleanEffect(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function getCachedAbilityEffect(abilityId: string): string | undefined {
  const id = normaliseAbilityId(abilityId);
  const memory = memoryCache.get(id);
  if (memory) return memory;

  if (typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem(`${STORAGE_PREFIX}${id}`)?.trim();
      if (cached) {
        memoryCache.set(id, cached);
        return cached;
      }
    } catch {
      // Browser caching is optional.
    }
  }

  return undefined;
}

export async function loadAbilityEffect(abilityId: string): Promise<string | undefined> {
  const id = normaliseAbilityId(abilityId);
  if (!id) return undefined;

  const cached = getCachedAbilityEffect(id);
  if (cached) return cached;

  const existing = pending.get(id);
  if (existing) return existing;

  const request = fetch(`https://pokeapi.co/api/v2/ability/${encodeURIComponent(id)}`)
    .then(async (response) => {
      if (!response.ok) return undefined;
      const payload = (await response.json()) as PokeApiAbilityPayload;
      const english = (payload.effect_entries ?? []).find((entry) => entry.language?.name === "en");
      const effect = cleanEffect(english?.short_effect ?? english?.effect ?? "");
      if (!effect) return undefined;

      memoryCache.set(id, effect);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(`${STORAGE_PREFIX}${id}`, effect);
        } catch {
          // Browser caching is optional.
        }
      }
      return effect;
    })
    .catch(() => undefined)
    .finally(() => pending.delete(id));

  pending.set(id, request);
  return request;
}
