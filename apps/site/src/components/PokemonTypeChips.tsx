import { useEffect, useState } from "react";
import {
  getCachedPokemonTypes,
  loadPokemonTypes,
  type PokemonTypeInfo,
} from "../lib/pokemon-types";

export function PokemonTypeChips({ speciesId }: { speciesId: number }) {
  const [types, setTypes] = useState<PokemonTypeInfo[]>(() => getCachedPokemonTypes(speciesId));

  useEffect(() => {
    let cancelled = false;
    setTypes(getCachedPokemonTypes(speciesId));
    void loadPokemonTypes(speciesId).then((value) => {
      if (!cancelled) setTypes(value);
    });
    return () => {
      cancelled = true;
    };
  }, [speciesId]);

  if (!types.length) {
    return (
      <div className="type-chip-row">
        <span className="type-chip type-chip--unknown">Type unavailable</span>
      </div>
    );
  }

  return (
    <div
      className="type-chip-row"
      aria-label={`Pokémon types: ${types.map((type) => type.label).join(", ")}`}
    >
      {types.map((type) => (
        <span key={type.id} className={`type-chip type-chip--${type.id}`}>
          {type.label}
        </span>
      ))}
    </div>
  );
}
