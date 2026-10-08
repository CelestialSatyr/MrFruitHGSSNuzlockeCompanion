import { useMemo, useState, type ReactNode } from "react";
import {
  analyseManualParty,
  findPartyRecommendations,
  getPairAvailability,
  type PartyPlannerPair,
  type PartyPlannerPokemon,
  type PartyPlannerRecommendation,
} from "@nuzlocke/core";
import { Link } from "react-router";
import { PrimaryTypeBadge } from "../components/PrimaryTypeBadge";
import { usePokemonTypeMap } from "../hooks/usePokemonTypes";
import { buildPartyPlannerData, collectPartyPlannerSpeciesIds } from "../lib/partyPlannerData";
import { getHgssSpriteUrl } from "../lib/pokemon";
import { useRunView } from "../context/RunViewContext";
import "../styles/party-planner.css";

type PlannerMode = "automatic" | "manual";

export function PartyPlannerPage() {
  const { dataset, state } = useRunView();
  const [mode, setMode] = useState<PlannerMode>("automatic");
  const [selectedPairIds, setSelectedPairIds] = useState<string[]>([]);
  const [rerollToken, setRerollToken] = useState(0);
  const speciesIds = useMemo(() => collectPartyPlannerSpeciesIds(dataset, state), [dataset, state]);
  const { typesBySpecies, loading, error } = usePokemonTypeMap(speciesIds);

  const plannerData = useMemo(
    () => buildPartyPlannerData(dataset, state, typesBySpecies),
    [dataset, state, typesBySpecies],
  );

  const recommendations = useMemo(() => {
    // rerollToken intentionally invalidates the calculation. Exact score ties
    // are randomly ordered, giving Mr Fruit another set of equally-good teams.
    void rerollToken;
    return findPartyRecommendations(plannerData.pairs, {
      maxPairs: 6,
      resultCount: 3,
    });
  }, [plannerData.pairs, rerollToken]);

  const pairById = useMemo(
    () => new Map(plannerData.pairs.map((pair) => [pair.id, pair])),
    [plannerData.pairs],
  );
  const selectedPairs = selectedPairIds
    .map((id) => pairById.get(id))
    .filter((pair): pair is PartyPlannerPair => pair !== undefined);
  const manualAnalysis = analyseManualParty(selectedPairs);

  function togglePair(pair: PartyPlannerPair) {
    const availability = getPairAvailability(pair, selectedPairs, 6);
    if (availability.state === "selected") {
      setSelectedPairIds((current) => current.filter((id) => id !== pair.id));
      return;
    }
    if (availability.state !== "available") return;
    setSelectedPairIds((current) => [...current, pair.id]);
  }

  const leftPlayer = dataset.players.find((player) => player.id === dataset.run.playerIds[0]);
  const rightPlayer = dataset.players.find((player) => player.id === dataset.run.playerIds[1]);

  return (
    <div className="page-stack party-planner-page">
      <header className="page-heading party-planner-heading">
        <div>
          <p className="eyebrow">Team building</p>
          <h1>Party Planner</h1>
          <p>
            Build the largest legal Soul Link party. Primary typings are unique across both teams;
            every link is selected as a pair.
          </p>
        </div>
        <div className="planner-mode-switch" role="group" aria-label="Party planner mode">
          <button
            type="button"
            className={mode === "automatic" ? "is-active" : ""}
            onClick={() => setMode("automatic")}
          >
            Best options
          </button>
          <button
            type="button"
            className={mode === "manual" ? "is-active" : ""}
            onClick={() => setMode("manual")}
          >
            Manual
          </button>
        </div>
      </header>

      <PlannerRuleStrip
        leftName={leftPlayer?.shortName ?? leftPlayer?.displayName ?? "Mr Fruit"}
        rightName={rightPlayer?.shortName ?? rightPlayer?.displayName ?? "Blue"}
        alivePairCount={plannerData.pairs.length}
      />

      {loading ? (
        <section className="planner-state-card">
          <strong>Loading party typings…</strong>
          <span>The planner is resolving HeartGold/SoulSilver typings for the alive links.</span>
        </section>
      ) : null}

      {error ? (
        <section className="planner-state-card planner-state-card--error">
          <strong>Typing data could not be loaded.</strong>
          <span>{error}</span>
        </section>
      ) : null}

      {!loading && !error && plannerData.unresolvedFlyingPokemonIds.length ? (
        <section className="planner-state-card planner-state-card--warning">
          <strong>Flying declaration required</strong>
          <span>
            {plannerData.unresolvedFlyingPokemonIds.length} alive Pokémon
            {plannerData.unresolvedFlyingPokemonIds.length === 1 ? " has" : " have"} a Flying
            capture with no recorded declaration. Edit the original encounter before using the
            planner.
          </span>
        </section>
      ) : null}

      {!loading && !error && plannerData.invalidPairIds.length ? (
        <section className="planner-state-card planner-state-card--warning">
          <strong>Invalid Soul Link data</strong>
          <span>
            {plannerData.invalidPairIds.length} active link
            {plannerData.invalidPairIds.length === 1 ? " has" : "s have"} matching effective primary
            typings and has been excluded.
          </span>
        </section>
      ) : null}

      {!loading && !error && !plannerData.unresolvedFlyingPokemonIds.length ? (
        mode === "automatic" ? (
          <AutomaticPlanner
            recommendations={recommendations}
            onReroll={() => setRerollToken((value) => value + 1)}
          />
        ) : (
          <ManualPlanner
            pairs={plannerData.pairs}
            selectedPairs={selectedPairs}
            analysis={manualAnalysis}
            onToggle={togglePair}
            onClear={() => setSelectedPairIds([])}
          />
        )
      ) : null}
    </div>
  );
}

function PlannerRuleStrip({
  leftName,
  rightName,
  alivePairCount,
}: {
  leftName: string;
  rightName: string;
  alivePairCount: number;
}) {
  return (
    <section className="planner-rule-strip">
      <div>
        <small>Left team</small>
        <strong>{leftName}</strong>
      </div>
      <div className="planner-rule-strip__rule">
        <strong>1 primary type across both parties</strong>
        <span>Up to 6 alive Soul Link pairs · {alivePairCount} usable links</span>
      </div>
      <div>
        <small>Right team</small>
        <strong>{rightName}</strong>
      </div>
    </section>
  );
}

function AutomaticPlanner({
  recommendations,
  onReroll,
}: {
  recommendations: PartyPlannerRecommendation[];
  onReroll(): void;
}) {
  if (!recommendations.length) {
    return (
      <section className="planner-state-card">
        <strong>No alive Soul Link pairs are available.</strong>
        <span>The recommendations will appear once there is at least one usable link.</span>
      </section>
    );
  }

  return (
    <section className="planner-results-section">
      <div className="section-heading planner-results-heading">
        <div>
          <p className="eyebrow">Automatic</p>
          <h2>Top party options</h2>
          <p>Pair count is ranked first, then total type variety, then the least typing overlap.</p>
        </div>
        <button type="button" className="secondary-button" onClick={onReroll}>
          Reroll tied options
        </button>
      </div>

      <div className="planner-recommendations">
        {recommendations.map((recommendation, index) => (
          <article
            className="planner-recommendation"
            key={`${index}-${recommendation.pairIds.join("-")}`}
          >
            <header className="planner-recommendation__heading">
              <div>
                <small>Option {index + 1}</small>
                <strong>{recommendation.score.pairCount}/6 linked pairs</strong>
              </div>
              <ScorePills score={recommendation.score} />
            </header>
            <div className="planner-pair-list">
              {recommendation.pairs.map((pair) => (
                <PlannerPairRow key={pair.id} pair={pair} centre={<span>Selected</span>} />
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ManualPlanner({
  pairs,
  selectedPairs,
  analysis,
  onToggle,
  onClear,
}: {
  pairs: PartyPlannerPair[];
  selectedPairs: PartyPlannerPair[];
  analysis: ReturnType<typeof analyseManualParty>;
  onToggle(pair: PartyPlannerPair): void;
  onClear(): void;
}) {
  const selectedIds = new Set(selectedPairs.map((pair) => pair.id));
  const ordered = [...pairs].sort((a, b) => {
    const aSelected = selectedIds.has(a.id) ? 0 : 1;
    const bSelected = selectedIds.has(b.id) ? 0 : 1;
    return aSelected - bSelected || a.id.localeCompare(b.id);
  });

  return (
    <section className="planner-manual-section">
      <div className="planner-manual-summary">
        <div>
          <p className="eyebrow">Manual party</p>
          <h2>{analysis.score.pairCount}/6 linked pairs</h2>
        </div>
        <ScorePills score={analysis.score} />
        <div className="planner-used-types">
          <small>Used primaries</small>
          <div>
            {analysis.usedPrimaryTypes.length ? (
              analysis.usedPrimaryTypes.map((type) => (
                <span key={type} className={`type-chip type-chip--${type}`}>
                  {titleCase(type)}
                </span>
              ))
            ) : (
              <span className="muted-copy">None yet</span>
            )}
          </div>
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={onClear}
          disabled={!selectedPairs.length}
        >
          Clear party
        </button>
      </div>

      <div className="planner-pair-list planner-pair-list--manual">
        {ordered.map((pair) => {
          const availability = getPairAvailability(pair, selectedPairs, 6);
          return (
            <PlannerPairRow
              key={pair.id}
              pair={pair}
              disabled={availability.state === "disabled"}
              selected={availability.state === "selected"}
              centre={
                <button
                  type="button"
                  onClick={() => onToggle(pair)}
                  disabled={availability.state === "disabled"}
                  title={availability.reason}
                >
                  {availability.state === "selected"
                    ? "Remove"
                    : availability.state === "disabled"
                      ? "Unavailable"
                      : "Add pair"}
                </button>
              }
              {...(availability.reason ? { reason: availability.reason } : {})}
            />
          );
        })}
      </div>
    </section>
  );
}

function PlannerPairRow({
  pair,
  centre,
  selected = false,
  disabled = false,
  reason,
}: {
  pair: PartyPlannerPair;
  centre: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  reason?: string;
}) {
  return (
    <article
      className={`planner-pair-row${selected ? " planner-pair-row--selected" : ""}${disabled ? " planner-pair-row--disabled" : ""}`}
    >
      <PlannerPokemon pokemon={pair.left} side="left" />
      <div className="planner-pair-row__centre">
        <span className="planner-pair-row__line" aria-hidden="true" />
        {centre}
        {reason ? <small>{reason}</small> : null}
        <span className="planner-pair-row__line" aria-hidden="true" />
      </div>
      <PlannerPokemon pokemon={pair.right} side="right" />
    </article>
  );
}

function PlannerPokemon({
  pokemon,
  side,
}: {
  pokemon: PartyPlannerPokemon;
  side: "left" | "right";
}) {
  return (
    <Link className={`planner-pokemon planner-pokemon--${side}`} to={`/pokemon/${pokemon.id}`}>
      <img
        src={getHgssSpriteUrl(pokemon.speciesId, pokemon.shiny ?? false)}
        alt=""
        loading="lazy"
      />
      <div className="planner-pokemon__copy">
        <strong>{pokemon.nickname ?? pokemon.speciesName}</strong>
        {pokemon.nickname ? <small>{pokemon.speciesName}</small> : null}
        <PrimaryTypeBadge
          type={pokemon.primaryType}
          flyingTypeDeclared={pokemon.flyingTypeDeclared}
          compact
        />
        <div className="planner-pokemon__actual-types" aria-label="Current typings">
          {pokemon.actualTypes.map((type) => (
            <span key={type} className={`type-chip type-chip--${type}`}>
              {titleCase(type)}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}

function ScorePills({ score }: { score: PartyPlannerRecommendation["score"] }) {
  return (
    <div className="planner-score-pills">
      <span>
        <b>{score.uniqueTypeCount}</b> unique types
      </span>
      <span>
        <b>{score.overlapCount}</b> overlaps
      </span>
    </div>
  );
}

function titleCase(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
