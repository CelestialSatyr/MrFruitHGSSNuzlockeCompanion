import type { PokemonState, RunDataset } from "@nuzlocke/core";
import { PrimaryTypeBadge } from "./PrimaryTypeBadge";
import { usePokemonTypeMap } from "../hooks/usePokemonTypes";
import { resolvePokemonRuleTyping } from "../lib/partyPlannerData";

export function PokemonPrimaryRuleBadges({
  dataset,
  pokemon,
}: {
  dataset: RunDataset;
  pokemon: PokemonState;
}) {
  const creation = dataset.events.find((event) => event.id === pokemon.createdByEventId);
  const captureOutcome =
    creation?.type === "encounter"
      ? creation.outcomes.find(
          (outcome) => outcome.result === "caught" && outcome.pokemonId === pokemon.id,
        )
      : undefined;
  const captureSpeciesId =
    captureOutcome?.result === "caught" ? captureOutcome.speciesId : pokemon.currentSpeciesId;
  const { typesBySpecies, loading, error } = usePokemonTypeMap([
    captureSpeciesId,
    pokemon.currentSpeciesId,
  ]);

  if (loading) return <span className="primary-type-loading">Loading primary…</span>;
  if (error) return null;

  const resolved = resolvePokemonRuleTyping(dataset, pokemon, typesBySpecies);
  if (!resolved) return null;

  return (
    <div>
      <PrimaryTypeBadge
        type={resolved.primaryType}
        flyingTypeDeclared={resolved.flyingTypeDeclared}
      />
      {resolved.requiresFlyingDeclaration ? (
        <small className="primary-type-warning">Flying declaration not recorded</small>
      ) : null}
    </div>
  );
}
