import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PokemonSpeciesOption } from "../shared/api-types.ts";

const MAX_HGSS_SPECIES = 493;
const SPECIAL_NAMES: Record<string, string> = {
  "nidoran-f": "Nidoran♀",
  "nidoran-m": "Nidoran♂",
  "mr-mime": "Mr. Mime",
  "mime-jr": "Mime Jr.",
  "ho-oh": "Ho-Oh",
  "porygon-z": "Porygon-Z",
};

function displayName(identifier: string): string {
  const special = SPECIAL_NAMES[identifier];
  if (special) return special;
  return identifier
    .split("-")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export async function loadSpeciesCatalog(repoRoot: string): Promise<PokemonSpeciesOption[]> {
  const cachePath = path.join(repoRoot, ".local", "cache", "hgss-species.json");
  try {
    return JSON.parse(await readFile(cachePath, "utf8")) as PokemonSpeciesOption[];
  } catch {
    // Populate the local cache below.
  }

  const response = await fetch(
    `https://pokeapi.co/api/v2/pokemon-species?limit=${MAX_HGSS_SPECIES}&offset=0`,
  );
  if (!response.ok) throw new Error(`PokéAPI species lookup failed (${response.status}).`);
  const payload = (await response.json()) as { results?: Array<{ name: string; url: string }> };
  const catalog = (payload.results ?? [])
    .map((entry) => {
      const match = /\/pokemon-species\/(\d+)\/?$/.exec(entry.url);
      return { id: Number(match?.[1] ?? 0), name: displayName(entry.name) };
    })
    .filter((entry) => entry.id >= 1 && entry.id <= MAX_HGSS_SPECIES)
    .sort((a, b) => a.id - b.id);
  if (catalog.length !== MAX_HGSS_SPECIES)
    throw new Error(
      `PokéAPI returned ${catalog.length} HGSS species instead of ${MAX_HGSS_SPECIES}.`,
    );
  await mkdir(path.dirname(cachePath), { recursive: true });
  await writeFile(cachePath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  return catalog;
}
