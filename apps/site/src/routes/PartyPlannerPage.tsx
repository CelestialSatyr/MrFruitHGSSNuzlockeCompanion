import { useMemo, useState, type ReactNode } from "react";
import {
  analyseManualParty,
  DEFAULT_PARTY_PLANNER_RANKING,
  findPartyRecommendations,
  getPairAvailability,
  type PartyPlannerPair,
  type PartyPlannerPokemon,
  type PartyPlannerRankingCriterion,
  type PartyPlannerRecommendation,
} from "@nuzlocke/core";
import { Link } from "react-router";
import { PrimaryTypeBadge } from "../components/PrimaryTypeBadge";
import { usePokemonPlannerDataMap } from "../hooks/usePokemonTypes";
import { buildPartyPlannerData, collectPartyPlannerSpeciesIds } from "../lib/partyPlannerData";
import { getHgssSpriteUrl } from "../lib/pokemon";
import { getPlayerTheme } from "../lib/player-theme";
import { useRunView } from "../context/RunViewContext";
import "../styles/party-planner.css";

type PlannerMode = "automatic" | "manual";

interface RankingItem {
  criterion: PartyPlannerRankingCriterion;
  enabled: boolean;
}

const RANKING_META: Record<
  PartyPlannerRankingCriterion,
  { label: string; shortLabel: string; direction: "Maximise" | "Minimise"; description: string }
> = {
  pairCount: {
    label: "Linked pairs",
    shortLabel: "pairs",
    direction: "Maximise",
    description: "Prefer parties containing more complete Soul Link pairs.",
  },
  uniqueTypeCount: {
    label: "Unique current types",
    shortLabel: "type variety",
    direction: "Maximise",
    description: "Prefer broader coverage from the Pokémon's current actual typings.",
  },
  overlapCount: {
    label: "Typing overlap",
    shortLabel: "overlap",
    direction: "Minimise",
    description: "Prefer fewer repeated current typings across the complete party.",
  },
  totalBaseStats: {
    label: "Total base stats",
    shortLabel: "BST",
    direction: "Maximise",
    description: "Prefer the highest combined BST from the Pokémon's current species.",
  },
};

function createDefaultRanking(): RankingItem[] {
  return DEFAULT_PARTY_PLANNER_RANKING.map((criterion) => ({ criterion, enabled: true }));
}

export function PartyPlannerPage() {
  const { dataset, state } = useRunView();
  const [mode, setMode] = useState<PlannerMode>("automatic");
  const [selectedPairIds, setSelectedPairIds] = useState<string[]>([]);
  const [rerollToken, setRerollToken] = useState(0);
  const [rankingItems, setRankingItems] = useState<RankingItem[]>(createDefaultRanking);
  const speciesIds = useMemo(() => collectPartyPlannerSpeciesIds(dataset, state), [dataset, state]);
  const { dataBySpecies, loading, error } = usePokemonPlannerDataMap(speciesIds);

  const plannerData = useMemo(
    () => buildPartyPlannerData(dataset, state, dataBySpecies),
    [dataset, state, dataBySpecies],
  );

  const activeRanking = useMemo(
    () => rankingItems.filter((item) => item.enabled).map((item) => item.criterion),
    [rankingItems],
  );

  const recommendations = useMemo(() => {
    // rerollToken intentionally invalidates the calculation. Exact score ties
    // are randomly ordered, giving another set of equally-ranked teams.
    void rerollToken;
    return findPartyRecommendations(plannerData.pairs, {
      maxPairs: 6,
      resultCount: 3,
      ranking: activeRanking,
    });
  }, [activeRanking, plannerData.pairs, rerollToken]);

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

  function setRankingEnabled(criterion: PartyPlannerRankingCriterion, enabled: boolean) {
    setRankingItems((current) =>
      current.map((item) => (item.criterion === criterion ? { ...item, enabled } : item)),
    );
  }

  function moveRanking(criterion: PartyPlannerRankingCriterion, direction: -1 | 1) {
    setRankingItems((current) => {
      const index = current.findIndex((item) => item.criterion === criterion);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      const item = next[index];
      const targetItem = next[target];
      if (!item || !targetItem) return current;
      next[index] = targetItem;
      next[target] = item;
      return next;
    });
  }

  function resetRanking() {
    setRankingItems(createDefaultRanking());
  }

  const leftPlayer = dataset.players.find((player) => player.id === dataset.run.playerIds[0]);
  const rightPlayer = dataset.players.find((player) => player.id === dataset.run.playerIds[1]);
  const leftTheme = leftPlayer ? getPlayerTheme(leftPlayer) : "silver";
  const rightTheme = rightPlayer ? getPlayerTheme(rightPlayer) : "gold";

  return (
    <div
      className={`page-stack party-planner-page party-planner-page--left-${leftTheme} party-planner-page--right-${rightTheme}`}
    >
      <header className="page-heading party-planner-heading">
        <div>
          <p className="eyebrow">Team building</p>
          <h1>Party Planner</h1>
          <p>
            Build and compare legal Soul Link parties. Primary typings are unique across both teams;
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
          <strong>Loading party data…</strong>
          <span>The planner is resolving typings and base stats for the alive links.</span>
        </section>
      ) : null}

      {error ? (
        <section className="planner-state-card planner-state-card--error">
          <strong>Pokémon data could not be loaded.</strong>
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
            rankingItems={rankingItems}
            activeRanking={activeRanking}
            onReroll={() => setRerollToken((value) => value + 1)}
            onSetRankingEnabled={setRankingEnabled}
            onMoveRanking={moveRanking}
            onResetRanking={resetRanking}
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
  rankingItems,
  activeRanking,
  onReroll,
  onSetRankingEnabled,
  onMoveRanking,
  onResetRanking,
}: {
  recommendations: PartyPlannerRecommendation[];
  rankingItems: RankingItem[];
  activeRanking: PartyPlannerRankingCriterion[];
  onReroll(): void;
  onSetRankingEnabled(criterion: PartyPlannerRankingCriterion, enabled: boolean): void;
  onMoveRanking(criterion: PartyPlannerRankingCriterion, direction: -1 | 1): void;
  onResetRanking(): void;
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
          <p>
            Enable the criteria you care about and arrange them from highest to lowest priority.
          </p>
        </div>
        <button type="button" className="secondary-button" onClick={onReroll}>
          Reroll tied options
        </button>
      </div>

      <RankingControls
        items={rankingItems}
        onSetEnabled={onSetRankingEnabled}
        onMove={onMoveRanking}
        onReset={onResetRanking}
      />

      {!activeRanking.length ? (
        <div className="planner-ranking-empty">
          All ranking criteria are disabled. Legal parties are currently ordered randomly.
        </div>
      ) : null}

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
                <PlannerPairRow
                  key={pair.id}
                  pair={pair}
                  centre={<span className="planner-pair-row__dot" aria-hidden="true" />}
                />
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function RankingControls({
  items,
  onSetEnabled,
  onMove,
  onReset,
}: {
  items: RankingItem[];
  onSetEnabled(criterion: PartyPlannerRankingCriterion, enabled: boolean): void;
  onMove(criterion: PartyPlannerRankingCriterion, direction: -1 | 1): void;
  onReset(): void;
}) {
  let enabledPriority = 0;

  return (
    <section className="planner-ranking-card" aria-label="Automatic ranking priorities">
      <header className="planner-ranking-card__heading">
        <div>
          <small>Ranking priorities</small>
          <strong>Highest priority is evaluated first</strong>
        </div>
        <button type="button" className="secondary-button" onClick={onReset}>
          Reset defaults
        </button>
      </header>

      <div className="planner-ranking-list">
        {items.map((item, index) => {
          const meta = RANKING_META[item.criterion];
          const priority = item.enabled ? ++enabledPriority : undefined;
          return (
            <div
              className={`planner-ranking-row${item.enabled ? "" : " planner-ranking-row--disabled"}`}
              key={item.criterion}
            >
              <label className="planner-ranking-toggle">
                <input
                  type="checkbox"
                  checked={item.enabled}
                  onChange={(event) => onSetEnabled(item.criterion, event.target.checked)}
                />
                <span className="planner-ranking-priority">
                  {priority === undefined ? "Off" : `#${priority}`}
                </span>
                <span className="planner-ranking-copy">
                  <strong>{meta.label}</strong>
                  <small>
                    {meta.direction} · {meta.description}
                  </small>
                </span>
              </label>
              <div className="planner-ranking-move" aria-label={`Move ${meta.label}`}>
                <button
                  type="button"
                  onClick={() => onMove(item.criterion, -1)}
                  disabled={index === 0}
                  aria-label={`Move ${meta.label} up`}
                  title="Higher priority"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => onMove(item.criterion, 1)}
                  disabled={index === items.length - 1}
                  aria-label={`Move ${meta.label} down`}
                  title="Lower priority"
                >
                  ↓
                </button>
              </div>
            </div>
          );
        })}
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
        <div className="planner-pair-row__primary planner-pair-row__primary--left">
          <PrimaryTypeBadge
            type={pair.left.primaryType}
            flyingTypeDeclared={pair.left.flyingTypeDeclared}
            compact
          />
        </div>
        <div className="planner-pair-row__control">{centre}</div>
        <div className="planner-pair-row__primary planner-pair-row__primary--right">
          <PrimaryTypeBadge
            type={pair.right.primaryType}
            flyingTypeDeclared={pair.right.flyingTypeDeclared}
            compact
          />
        </div>
        {reason ? <small>{reason}</small> : null}
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
        <div className="planner-pokemon__actual-types" aria-label="Current typings">
          {pokemon.actualTypes.map((type) => (
            <span key={type} className={`type-chip type-chip--${type}`}>
              {titleCase(type)}
            </span>
          ))}
        </div>
        <small className="planner-pokemon__bst">BST {pokemon.baseStatTotal}</small>
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
      <span>
        <b>{score.totalBaseStats.toLocaleString()}</b> total BST
      </span>
    </div>
  );
}

function titleCase(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
