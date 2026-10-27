import { useEffect, useState } from "react";
import { getCachedAbilityEffect, loadAbilityEffect } from "../lib/ability-effects";

export function useAbilityEffect(abilityId: string | undefined) {
  const [effect, setEffect] = useState<string | undefined>(() =>
    abilityId ? getCachedAbilityEffect(abilityId) : undefined,
  );

  useEffect(() => {
    let cancelled = false;
    if (!abilityId) {
      setEffect(undefined);
      return () => undefined;
    }

    const cached = getCachedAbilityEffect(abilityId);
    setEffect(cached);
    if (cached) return () => undefined;

    void loadAbilityEffect(abilityId).then((value) => {
      if (!cancelled) setEffect(value);
    });

    return () => {
      cancelled = true;
    };
  }, [abilityId]);

  return effect;
}
