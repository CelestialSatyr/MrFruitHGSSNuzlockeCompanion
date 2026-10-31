import { useEffect, useMemo, useState } from "react";
import { getHgssEvolutionProjectionMap, type HgssEvolutionProjection } from "@nuzlocke/hgss";
import type { PokemonGender } from "@nuzlocke/core";

export interface PokemonEvolutionProjectionRequest {
  pokemonId: string;
  speciesId: number;
  gender?: PokemonGender | undefined;
}

export function usePokemonEvolutionProjectionMap(
  entries: readonly PokemonEvolutionProjectionRequest[],
  levelCap: number,
) {
  const key = useMemo(
    () =>
      entries
        .map((entry) => `${entry.pokemonId}:${entry.speciesId}:${entry.gender ?? "unknown"}`)
        .sort()
        .join("|"),
    [entries],
  );
  const [projectionByPokemonId, setProjectionByPokemonId] = useState<
    Map<string, HgssEvolutionProjection>
  >(() => new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    setError(undefined);
    if (!key) {
      setProjectionByPokemonId(new Map());
      setLoading(false);
      return () => undefined;
    }

    const requests = key.split("|").map((entry) => {
      const [pokemonId = "", speciesIdRaw = "0", genderRaw = "unknown"] = entry.split(":");
      const gender: PokemonGender =
        genderRaw === "male" || genderRaw === "female" ? genderRaw : "unknown";
      return { pokemonId, speciesId: Number(speciesIdRaw), gender };
    });

    setLoading(true);
    void getHgssEvolutionProjectionMap(requests, levelCap)
      .then((value) => {
        if (cancelled) return;
        setProjectionByPokemonId(value);
        setLoading(false);
      })
      .catch((value: unknown) => {
        if (cancelled) return;
        setError(value instanceof Error ? value.message : String(value));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [key, levelCap]);

  return { projectionByPokemonId, loading, error };
}
