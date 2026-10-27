import { useMemo } from "react";
import { getHgssAbilityFit, getHgssNatureFit, type HgssMovePlannerData } from "@nuzlocke/hgss";
import { usePokemonMoveDataMap } from "./usePokemonMoves";
import { usePokemonPlannerDataMap } from "./usePokemonTypes";

export function usePokemonTraitFit({
  speciesId,
  abilityId,
  natureId,
  knownMoveIds,
}: {
  speciesId: number;
  abilityId: string | undefined;
  natureId: string | undefined;
  knownMoveIds: readonly string[];
}) {
  const { dataBySpecies, loading: speciesLoading } = usePokemonPlannerDataMap([speciesId]);
  const { dataByMove, loading: movesLoading } = usePokemonMoveDataMap(knownMoveIds);

  return useMemo(() => {
    const species = dataBySpecies.get(speciesId);
    const moves = knownMoveIds
      .map((id) =>
        dataByMove.get(id.trim().toLowerCase().replaceAll("_", "-").replaceAll(" ", "-")),
      )
      .filter((move): move is HgssMovePlannerData => move !== undefined);
    return {
      abilityFit: getHgssAbilityFit(abilityId, {
        knownMoveIds,
        moves,
        ...(species ? { currentTypes: species.types } : {}),
      }),
      natureFit: getHgssNatureFit(natureId, {
        moves,
        ...(species ? { baseStats: species.baseStats } : {}),
      }),
      loading: speciesLoading || movesLoading,
    };
  }, [
    abilityId,
    dataByMove,
    dataBySpecies,
    knownMoveIds,
    movesLoading,
    natureId,
    speciesId,
    speciesLoading,
  ]);
}
