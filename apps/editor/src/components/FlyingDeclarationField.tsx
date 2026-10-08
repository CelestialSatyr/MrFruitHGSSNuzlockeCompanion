import { useEffect, useState } from "react";
import { formatPokemonType, type PokemonType } from "@nuzlocke/core";
import { getHgssPokemonTypes } from "@nuzlocke/hgss";

type Declaration = boolean | null;

export function FlyingDeclarationField({
  speciesId,
  result,
  value,
  onChange,
}: {
  speciesId: string;
  result: "caught" | "failed" | "skipped";
  value: Declaration;
  onChange(value: Declaration): void;
}) {
  const numericSpeciesId = Number(speciesId);
  const [types, setTypes] = useState<readonly PokemonType[]>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    setTypes(undefined);
    setError(undefined);

    if (result !== "caught" || !Number.isFinite(numericSpeciesId) || numericSpeciesId <= 0) {
      return () => undefined;
    }

    void getHgssPokemonTypes(numericSpeciesId)
      .then((resolved) => {
        if (!cancelled) setTypes(resolved);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason));
      });

    return () => {
      cancelled = true;
    };
  }, [numericSpeciesId, result]);

  useEffect(() => {
    if (!types?.length || result !== "caught") return;
    if (types[1] !== "flying" && value !== false) onChange(false);
  }, [types, result, value, onChange]);

  if (result !== "caught" || !speciesId) return null;

  if (error) {
    return (
      <div className="field">
        <span>Primary typing rule</span>
        <small className="field-error">{error}</small>
      </div>
    );
  }

  if (!types) {
    return (
      <div className="field">
        <span>Primary typing rule</span>
        <small>Loading HGSS typing…</small>
      </div>
    );
  }

  const capturedPrimary = types[0];
  if (!capturedPrimary) return null;

  const eligibleForFlyingClause = types[1] === "flying";
  if (!eligibleForFlyingClause) {
    return (
      <div className="field">
        <span>Primary typing rule</span>
        <strong className={`typing-rule-pill typing-rule-pill--${capturedPrimary}`}>
          Primary · {formatPokemonType(capturedPrimary)}
        </strong>
        <small>Locked from the species' primary typing when caught.</small>
      </div>
    );
  }

  return (
    <label className="field">
      <span>Primary typing rule</span>
      <select
        value={value === null ? "" : value ? "flying" : "primary"}
        onChange={(event) => {
          if (event.target.value === "") onChange(null);
          else onChange(event.target.value === "flying");
        }}
      >
        <option value="">Choose declaration…</option>
        <option value="primary">Use {formatPokemonType(capturedPrimary)} primary</option>
        <option value="flying">Declare Flying</option>
      </select>
      <small>
        Flying Clause decision is permanent for this capture. A declared Pokémon counts as Flying
        while its current evolution still has Flying; gaining Flying later never grants the clause.
      </small>
    </label>
  );
}
