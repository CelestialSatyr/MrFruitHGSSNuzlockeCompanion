import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { PokemonAbilityOption } from "../shared/api-types.ts";

interface PokeApiListResponse {
  results?: Array<{ name?: string }>;
}

export async function loadAbilityCatalog(repoRoot: string): Promise<PokemonAbilityOption[]> {
  const cache = join(repoRoot, ".local", "cache", "abilities.json");
  try {
    const cached = JSON.parse(await readFile(cache, "utf8")) as PokemonAbilityOption[];
    if (Array.isArray(cached) && cached.length) return cached;
  } catch {
    /* cache miss */
  }

  try {
    const response = await fetch("https://pokeapi.co/api/v2/ability?limit=1000");
    if (!response.ok) throw new Error(`PokéAPI returned ${response.status}.`);
    const payload = (await response.json()) as PokeApiListResponse;
    const abilities = (payload.results ?? [])
      .map((entry) => entry.name?.trim())
      .filter((name): name is string => Boolean(name))
      .map((name) => ({
        id: name,
        name: name
          .split("-")
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" "),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (abilities.length) {
      await mkdir(dirname(cache), { recursive: true });
      await writeFile(cache, JSON.stringify(abilities, null, 2) + "\n", "utf8");
    }
    return abilities;
  } catch {
    return [];
  }
}
