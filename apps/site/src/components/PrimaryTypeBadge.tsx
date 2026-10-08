import { formatPokemonType, type PokemonType } from "@nuzlocke/core";

export function PrimaryTypeBadge({
  type,
  flyingTypeDeclared = false,
  compact = false,
}: {
  type: PokemonType;
  flyingTypeDeclared?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={`primary-type-badges${compact ? " primary-type-badges--compact" : ""}`}>
      <span className={`type-chip type-chip--${type} primary-type-badge`}>
        Primary · {formatPokemonType(type)}
      </span>
      {flyingTypeDeclared ? (
        <span className="flying-declaration-badge">Flying Type Declared</span>
      ) : null}
    </div>
  );
}
