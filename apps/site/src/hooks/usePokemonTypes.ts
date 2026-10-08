import { useEffect, useMemo, useState } from "react";
import type { PokemonType } from "@nuzlocke/core";
import { getHgssPokemonTypeMap, getHgssPokemonTypes } from "@nuzlocke/hgss";

export function usePokemonTypes(speciesId: number | undefined) {
  const [types, setTypes] = useState<readonly PokemonType[] | undefined>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    setTypes(undefined);
    setError(undefined);
    if (!speciesId) return () => undefined;

    void getHgssPokemonTypes(speciesId)
      .then((value) => {
        if (!cancelled) setTypes(value);
      })
      .catch((value: unknown) => {
        if (!cancelled) setError(value instanceof Error ? value.message : String(value));
      });

    return () => {
      cancelled = true;
    };
  }, [speciesId]);

  return { types, error, loading: Boolean(speciesId) && !types && !error };
}

export function usePokemonTypeMap(speciesIds: readonly number[]) {
  const key = useMemo(() => [...new Set(speciesIds)].sort((a, b) => a - b).join(","), [speciesIds]);
  const [typesBySpecies, setTypesBySpecies] = useState<Map<number, readonly PokemonType[]>>(
    () => new Map(),
  );
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const ids = key ? key.split(",").map(Number) : [];
    setError(undefined);
    if (!ids.length) {
      setTypesBySpecies(new Map());
      setLoading(false);
      return () => undefined;
    }

    setLoading(true);
    void getHgssPokemonTypeMap(ids)
      .then((value) => {
        if (cancelled) return;
        setTypesBySpecies(value);
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
  }, [key]);

  return { typesBySpecies, error, loading };
}
