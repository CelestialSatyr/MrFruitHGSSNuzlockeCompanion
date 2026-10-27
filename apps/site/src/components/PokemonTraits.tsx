import {
  formatAbilityName,
  formatNatureStat,
  getHgssAbilityEffectTone,
  getHgssNatureEffect,
  type AbilityEffectTone,
  type NatureFitTone,
} from "@nuzlocke/hgss";
import { useAbilityEffect } from "../hooks/useAbilityEffect";

export function PokemonAbilityBadge({
  abilityId,
  tone,
  compact = false,
}: {
  abilityId: string | undefined;
  tone?: AbilityEffectTone;
  compact?: boolean;
}) {
  const effect = useAbilityEffect(abilityId);
  if (!abilityId) return null;

  const resolvedTone = tone ?? getHgssAbilityEffectTone(abilityId);
  const label = formatAbilityName(abilityId);
  const effectText = effect ?? `${label} effect description is unavailable.`;

  return (
    <span
      className={`pokemon-trait-badge pokemon-trait-badge--ability pokemon-trait-badge--${resolvedTone}${compact ? " pokemon-trait-badge--compact" : ""}`}
      tabIndex={0}
      aria-label={`${label}. ${effectText}`}
    >
      <span className="pokemon-trait-badge__label">Ability</span>
      <strong>{label}</strong>
      <span className="pokemon-trait-tooltip" role="tooltip" aria-hidden="true">
        <span className="pokemon-trait-tooltip__eyebrow">Ability effect</span>
        <strong className="pokemon-trait-tooltip__title">{label}</strong>
        <span className="pokemon-trait-tooltip__body">{effectText}</span>
      </span>
    </span>
  );
}

export function PokemonNatureBadge({
  natureId,
  fitTone,
  fitNote,
  compact = false,
}: {
  natureId: string | undefined;
  fitTone?: NatureFitTone;
  fitNote?: string | undefined;
  compact?: boolean;
}) {
  if (!natureId) return null;

  const nature = getHgssNatureEffect(natureId);
  const neutral = !nature.increasedStat || !nature.decreasedStat;
  const effectText = neutral
    ? `${nature.name}: no stat changes.`
    : `${nature.name}: +10% ${formatNatureStat(nature.increasedStat!)}; -10% ${formatNatureStat(nature.decreasedStat!)}.`;
  const tooltip = fitNote ? `${effectText}\n\nCurrent fit: ${fitNote}` : effectText;

  return (
    <span
      className={`pokemon-trait-badge pokemon-trait-badge--nature${fitTone ? ` pokemon-trait-badge--fit-${fitTone}` : ""}${compact ? " pokemon-trait-badge--compact" : ""}`}
      title={tooltip}
      aria-label={tooltip}
    >
      <span className="pokemon-trait-badge__nature-heading">
        <span className="pokemon-trait-badge__label">Nature:</span>
        <strong>{nature.name}</strong>
      </span>
      {neutral ? (
        <span className="nature-effect nature-effect--neutral">No stat changes</span>
      ) : (
        <span className="nature-effect" aria-hidden="true">
          <span className="nature-effect__up">↑ {formatNatureStat(nature.increasedStat!)}</span>
          <span className="nature-effect__down">↓ {formatNatureStat(nature.decreasedStat!)}</span>
        </span>
      )}
    </span>
  );
}
