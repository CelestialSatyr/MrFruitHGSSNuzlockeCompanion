import { useEffect, useMemo, useState } from "react";
import { getHgssMovePlannerDataMap, type HgssMovePlannerData } from "@nuzlocke/hgss";

export function usePokemonMoveDataMap(moveIds: readonly string[]) {
  const key = useMemo(
    () =>
      [
        ...new Set(
          moveIds.map((id) => id.trim().toLowerCase().replaceAll("_", "-").replaceAll(" ", "-")),
        ),
      ]
        .filter(Boolean)
        .sort()
        .join(","),
    [moveIds],
  );
  const [dataByMove, setDataByMove] = useState<Map<string, HgssMovePlannerData>>(() => new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const ids = key ? key.split(",") : [];
    if (!ids.length) {
      setDataByMove(new Map());
      setLoading(false);
      return () => undefined;
    }

    setLoading(true);
    void getHgssMovePlannerDataMap(ids).then((value) => {
      if (cancelled) return;
      setDataByMove(value);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [key]);

  return { dataByMove, loading };
}
