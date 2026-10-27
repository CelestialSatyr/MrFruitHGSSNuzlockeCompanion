import type { PokemonState, RunDataset } from "@nuzlocke/core";
import { usePokemonTypeMap } from "../hooks/usePokemonTypes";
import { resolvePokemonRuleTyping } from "../lib/partyPlannerData";
import { PokemonTypeChips } from "./PokemonTypeChips";

export function PokemonRuleTypeChips({
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
  const { typesBySpecies } = usePokemonTypeMap([captureSpeciesId, pokemon.currentSpeciesId]);
  const resolved = resolvePokemonRuleTyping(dataset, pokemon, typesBySpecies);

  return (
    <PokemonTypeChips
      speciesId={pokemon.currentSpeciesId}
      emphasizePrimary
      {...(resolved ? { primaryType: resolved.primaryType } : {})}
    />
  );
}
