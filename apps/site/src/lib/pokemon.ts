const SPECIES_NAMES: Readonly<Record<number, string>> = {
  16: "Pidgey",
  92: "Gastly",
  155: "Cyndaquil",
  156: "Quilava",
  158: "Totodile",
  161: "Sentret",
  179: "Mareep",
};

export function getSpeciesName(speciesId: number): string {
  return SPECIES_NAMES[speciesId] ?? `Pokémon #${speciesId}`;
}

export function getHgssSpriteUrl(speciesId: number, shiny = false): string {
  const shinySegment = shiny ? "shiny/" : "";
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-iv/heartgold-soulsilver/${shinySegment}${speciesId}.png`;
}

export function getOfficialArtworkUrl(speciesId: number, shiny = false): string {
  const shinySegment = shiny ? "shiny/" : "";
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${shinySegment}${speciesId}.png`;
}
