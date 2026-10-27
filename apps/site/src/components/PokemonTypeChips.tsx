import { formatPokemonType, type PokemonType } from "@nuzlocke/core";
import { usePokemonTypes } from "../hooks/usePokemonTypes";

export function PokemonTypeChips({
  speciesId,
  primaryType,
  emphasizePrimary = false,
}: {
  speciesId: number;
  primaryType?: PokemonType;
  emphasizePrimary?: boolean;
}) {
  const { types, error } = usePokemonTypes(speciesId);

  if (error) {
    return (
      <div className="type-chip-row" title={error}>
        <span className="type-chip type-chip--unknown">Type unavailable</span>
      </div>
    );
  }

  if (!types) return null;

  const primaryIsCurrent = primaryType ? types.includes(primaryType) : false;

  return (
    <div className="type-chip-row">
      {types.map((type) => {
        const isPrimary = emphasizePrimary && primaryType === type;
        return (
          <span
            key={type}
            className={`type-chip type-chip--${type}${isPrimary ? " type-chip--primary" : ""}`}
            {...(isPrimary ? { title: `Nuzlocke primary type: ${formatPokemonType(type)}` } : {})}
          >
            {isPrimary ? (
              <span className="type-chip__primary-mark" aria-hidden="true">
                ◆
              </span>
            ) : null}
            {formatPokemonType(type)}
          </span>
        );
      })}
      {emphasizePrimary && primaryType && !primaryIsCurrent ? (
        <span
          className={`type-chip type-chip--${primaryType} type-chip--primary type-chip--primary-historical`}
          title={`Nuzlocke primary type: ${formatPokemonType(primaryType)} · not a current type`}
        >
          <span className="type-chip__primary-mark" aria-hidden="true">
            ◆
          </span>
          {formatPokemonType(primaryType)}
        </span>
      ) : null}
    </div>
  );
}
