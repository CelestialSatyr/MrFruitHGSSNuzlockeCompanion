import type { PokemonState } from "@nuzlocke/core";
import { Link } from "react-router";
import { getHgssSpriteUrl, getSpeciesName } from "../lib/pokemon";

interface PokemonPortraitProps {
  pokemon: PokemonState;
  compact?: boolean;
}

export function PokemonPortrait({ pokemon, compact = false }: PokemonPortraitProps) {
  const species = getSpeciesName(pokemon.currentSpeciesId);
  const displayName = pokemon.currentNickname ?? species;
  const shiny = pokemon.source.shiny;

  return (
    <Link
      className={`pokemon-portrait${compact ? " pokemon-portrait--compact" : ""}${shiny ? " pokemon-portrait--shiny" : ""}`}
      to={`/pokemon/${pokemon.id}`}
    >
      <span className="pokemon-portrait__sprite-wrap">
        <img src={getHgssSpriteUrl(pokemon.currentSpeciesId, shiny)} alt="" loading="lazy" />
        {shiny ? <span className="shiny-badge">✨ Shiny</span> : null}
      </span>
      <span className="pokemon-portrait__copy">
        <strong>{displayName}</strong>
        {pokemon.currentNickname ? <small>{species}</small> : null}
      </span>
    </Link>
  );
}
