import type { PokemonGender } from "@nuzlocke/core";
import type { HgssProgressionState } from "./progression.ts";

interface NamedResource {
  name: string;
  url?: string;
}

interface PokeApiPokemonSpecies {
  evolution_chain: { url: string } | null;
}

interface PokeApiEvolutionDetail {
  trigger: NamedResource;
  min_level: number | null;
  gender: number | null;
  held_item: NamedResource | null;
  item: NamedResource | null;
  known_move: NamedResource | null;
  known_move_type: NamedResource | null;
  location: NamedResource | null;
  min_happiness: number | null;
  min_beauty: number | null;
  min_affection: number | null;
  needs_overworld_rain: boolean;
  party_species: NamedResource | null;
  party_type: NamedResource | null;
  relative_physical_stats: number | null;
  time_of_day: string;
  trade_species: NamedResource | null;
  turn_upside_down: boolean;
}

interface PokeApiEvolutionLink {
  species: NamedResource & { url: string };
  evolution_details: PokeApiEvolutionDetail[];
  evolves_to: PokeApiEvolutionLink[];
}

interface PokeApiEvolutionChain {
  chain: PokeApiEvolutionLink;
}

export interface HgssEvolutionProjection {
  currentSpeciesId: number;
  projectedSpeciesId: number;
  pathSpeciesIds: readonly number[];
  levelCap: number;
  ambiguous: boolean;
}

export interface HgssLevelCapInfo {
  level: number;
  label: string;
}

interface EvolutionContext {
  gender?: PokemonGender | undefined;
}

interface RandomizerEvolutionOverride {
  from: number;
  to: number;
  requiredLevel?: number | undefined;
}

/**
 * The run uses Universal Pokémon Randomizer's "Change Impossible Evolutions"
 * option. These are the HGSS-specific level gates that differ materially from
 * the stock evolution chain. Item-based replacements intentionally have no
 * required level: the projection asks what form can exist by the current cap,
 * not whether the item is currently sitting in the bag.
 */
const HGSS_RANDOMIZER_EVOLUTION_OVERRIDES: readonly RandomizerEvolutionOverride[] = [
  { from: 64, to: 65, requiredLevel: 37 }, // Kadabra -> Alakazam
  { from: 75, to: 76, requiredLevel: 37 }, // Graveler -> Golem
  { from: 67, to: 68, requiredLevel: 37 }, // Machoke -> Machamp
  { from: 93, to: 94, requiredLevel: 37 }, // Haunter -> Gengar
  { from: 82, to: 462, requiredLevel: 40 }, // Magneton -> Magnezone
  { from: 299, to: 476, requiredLevel: 40 }, // Nosepass -> Probopass
  { from: 349, to: 350, requiredLevel: 35 }, // Feebas -> Milotic
  { from: 79, to: 199 }, // Slowpoke -> Slowking (Water Stone)
  { from: 95, to: 208 }, // Onix -> Steelix (level w/ Metal Coat)
  { from: 112, to: 464 }, // Rhydon -> Rhyperior (level w/ Protector)
  { from: 117, to: 230 }, // Seadra -> Kingdra (level w/ Dragon Scale)
  { from: 123, to: 212 }, // Scyther -> Scizor (level w/ Metal Coat)
  { from: 125, to: 466 }, // Electabuzz -> Electivire (level w/ Electirizer)
  { from: 126, to: 467 }, // Magmar -> Magmortar (level w/ Magmarizer)
  { from: 133, to: 470 }, // Eevee -> Leafeon (Leaf Stone)
  { from: 133, to: 471 }, // Eevee -> Glaceon (Dawn Stone)
  { from: 137, to: 233 }, // Porygon -> Porygon2 (level w/ Up-Grade)
  { from: 233, to: 474 }, // Porygon2 -> Porygon-Z (level w/ Dubious Disc)
  { from: 356, to: 477 }, // Dusclops -> Dusknoir (level w/ Reaper Cloth)
  { from: 366, to: 367 }, // Clamperl -> Huntail (level w/ DeepSeaTooth)
  { from: 366, to: 368 }, // Clamperl -> Gorebyss (level w/ DeepSeaScale)
  // Poliwhirl -> Politoed is level-up while holding King's Rock. No fixed
  // level is introduced by the randomizer, so the stock branch stays possible.
] as const;

const RANDOMIZER_OVERRIDE_BY_EDGE = new Map(
  HGSS_RANDOMIZER_EVOLUTION_OVERRIDES.map((entry) => [`${entry.from}:${entry.to}`, entry] as const),
);

/** Level-cap stages used by the run after each earned Johto badge. */
const HGSS_LEVEL_CAP_STAGES: readonly HgssLevelCapInfo[] = [
  { level: 13, label: "Falkner" },
  { level: 17, label: "Bugsy" },
  { level: 19, label: "Whitney" },
  { level: 25, label: "Morty" },
  { level: 31, label: "Chuck" },
  { level: 35, label: "Jasmine" },
  // Pryce's ace is lower than Jasmine's, so the effective cap stays at 35
  // rather than asking the player to de-level after earning another badge.
  { level: 35, label: "Pryce" },
  { level: 41, label: "Clair" },
  { level: 50, label: "Pokémon League" },
] as const;

const speciesPromiseCache = new Map<number, Promise<PokeApiPokemonSpecies>>();
const chainPromiseCache = new Map<string, Promise<PokeApiEvolutionChain>>();

export function getHgssPlannerLevelCap(progression: HgssProgressionState): HgssLevelCapInfo {
  const earnedBadgeCount = Object.values(progression.badges).filter(Boolean).length;
  return HGSS_LEVEL_CAP_STAGES[earnedBadgeCount] ?? { level: 50, label: "Pokémon League" };
}

function speciesIdFromUrl(url: string | undefined): number | undefined {
  if (!url) return undefined;
  const match = url.match(/\/pokemon-species\/(\d+)\/?$/);
  if (!match?.[1]) return undefined;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : undefined;
}

function getSpeciesPayload(speciesId: number): Promise<PokeApiPokemonSpecies> {
  const existing = speciesPromiseCache.get(speciesId);
  if (existing) return existing;
  const request = fetch(`https://pokeapi.co/api/v2/pokemon-species/${speciesId}`)
    .then(async (response) => {
      if (!response.ok)
        throw new Error(`Could not load evolution data for #${speciesId} (${response.status}).`);
      return (await response.json()) as PokeApiPokemonSpecies;
    })
    .catch((error) => {
      speciesPromiseCache.delete(speciesId);
      throw error;
    });
  speciesPromiseCache.set(speciesId, request);
  return request;
}

function getEvolutionChain(url: string): Promise<PokeApiEvolutionChain> {
  const existing = chainPromiseCache.get(url);
  if (existing) return existing;
  const request = fetch(url)
    .then(async (response) => {
      if (!response.ok)
        throw new Error(`Could not load Pokémon evolution chain (${response.status}).`);
      return (await response.json()) as PokeApiEvolutionChain;
    })
    .catch((error) => {
      chainPromiseCache.delete(url);
      throw error;
    });
  chainPromiseCache.set(url, request);
  return request;
}

function findEvolutionNode(
  node: PokeApiEvolutionLink,
  speciesId: number,
): PokeApiEvolutionLink | undefined {
  if (speciesIdFromUrl(node.species.url) === speciesId) return node;
  for (const child of node.evolves_to) {
    const found = findEvolutionNode(child, speciesId);
    if (found) return found;
  }
  return undefined;
}

function genderMatches(detail: PokeApiEvolutionDetail, gender: PokemonGender | undefined): boolean {
  if (detail.gender === null || gender === undefined || gender === "unknown") return true;
  // PokeAPI uses 1 = female and 2 = male for evolution requirements.
  if (detail.gender === 1) return gender === "female";
  if (detail.gender === 2) return gender === "male";
  return true;
}

function detailRequiredLevel(
  fromSpeciesId: number,
  toSpeciesId: number,
  detail: PokeApiEvolutionDetail,
): number {
  const randomizer = RANDOMIZER_OVERRIDE_BY_EDGE.get(`${fromSpeciesId}:${toSpeciesId}`);
  if (randomizer?.requiredLevel !== undefined) return randomizer.requiredLevel;
  if (randomizer) return 1;
  if (detail.min_level !== null) return detail.min_level;
  // Friendship, stones, held-item level-ups and other non-fixed-level methods
  // are considered possible by the cap. Split branches are handled separately
  // and are never guessed.
  return 1;
}

function eligibleChildIds(
  node: PokeApiEvolutionLink,
  levelCap: number,
  context: EvolutionContext,
): { id: number; node: PokeApiEvolutionLink; requiredLevel: number }[] {
  const fromSpeciesId = speciesIdFromUrl(node.species.url);
  if (fromSpeciesId === undefined) return [];

  return node.evolves_to.flatMap((child) => {
    const toSpeciesId = speciesIdFromUrl(child.species.url);
    if (toSpeciesId === undefined || toSpeciesId > 493) return [];
    const matching = child.evolution_details.filter((detail) =>
      genderMatches(detail, context.gender),
    );
    if (!matching.length) return [];
    const requiredLevel = Math.min(
      ...matching.map((detail) => detailRequiredLevel(fromSpeciesId, toSpeciesId, detail)),
    );
    return requiredLevel <= levelCap ? [{ id: toSpeciesId, node: child, requiredLevel }] : [];
  });
}

export function resolveHgssEvolutionProjectionFromChain(
  currentSpeciesId: number,
  levelCap: number,
  chain: PokeApiEvolutionChain,
  context: EvolutionContext = {},
): HgssEvolutionProjection {
  const start = findEvolutionNode(chain.chain, currentSpeciesId);
  if (!start) {
    return {
      currentSpeciesId,
      projectedSpeciesId: currentSpeciesId,
      pathSpeciesIds: [currentSpeciesId],
      levelCap,
      ambiguous: false,
    };
  }

  const path: number[] = [currentSpeciesId];
  let current = start;
  let ambiguous = false;

  while (true) {
    const eligible = eligibleChildIds(current, levelCap, context);
    if (eligible.length === 0) break;
    if (eligible.length > 1) {
      ambiguous = true;
      break;
    }
    const next = eligible[0];
    if (!next) break;
    path.push(next.id);
    current = next.node;
  }

  return {
    currentSpeciesId,
    projectedSpeciesId: path[path.length - 1] ?? currentSpeciesId,
    pathSpeciesIds: path,
    levelCap,
    ambiguous,
  };
}

export async function getHgssEvolutionProjection(
  currentSpeciesId: number,
  levelCap: number,
  context: EvolutionContext = {},
): Promise<HgssEvolutionProjection> {
  const species = await getSpeciesPayload(currentSpeciesId);
  if (!species.evolution_chain?.url) {
    return {
      currentSpeciesId,
      projectedSpeciesId: currentSpeciesId,
      pathSpeciesIds: [currentSpeciesId],
      levelCap,
      ambiguous: false,
    };
  }
  const chain = await getEvolutionChain(species.evolution_chain.url);
  return resolveHgssEvolutionProjectionFromChain(currentSpeciesId, levelCap, chain, context);
}

export async function getHgssEvolutionProjectionMap(
  entries: readonly { pokemonId: string; speciesId: number; gender?: PokemonGender | undefined }[],
  levelCap: number,
): Promise<Map<string, HgssEvolutionProjection>> {
  const results = await Promise.all(
    entries.map(
      async (entry) =>
        [
          entry.pokemonId,
          await getHgssEvolutionProjection(entry.speciesId, levelCap, { gender: entry.gender }),
        ] as const,
    ),
  );
  return new Map(results);
}

export function clearHgssEvolutionProjectionCache(): void {
  speciesPromiseCache.clear();
  chainPromiseCache.clear();
}
