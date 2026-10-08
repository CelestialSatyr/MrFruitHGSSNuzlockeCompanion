import { formatPokemonType } from "@nuzlocke/core";
import { usePokemonTypes } from "../hooks/usePokemonTypes";

export function PokemonTypeChips({ speciesId }: { speciesId: number }) {
  const { types, error } = usePokemonTypes(speciesId);

  if (error) {
    return (
      <div className="type-chip-row" title={error}>
        <span className="type-chip type-chip--unknown">Type unavailable</span>
      </div>
    );
  }

  if (!types) return null;

  return (
    <div className="type-chip-row">
      {types.map((type) => (
        <span key={type} className={`type-chip type-chip--${type}`}>
          {formatPokemonType(type)}
        </span>
      ))}
    </div>
  );
}
