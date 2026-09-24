import {
  selectActiveSoulLinks,
  selectLostSoulLinks,
  selectPartyForPlayer,
  type Player,
  type PokemonState,
} from "@nuzlocke/core";
import { Link } from "react-router";
import { BadgeCase } from "../components/BadgeCase";
import { PokemonTypeChips } from "../components/PokemonTypeChips";
import { useRunView } from "../context/RunViewContext";
import { getHgssSpriteUrl, getSpeciesName } from "../lib/pokemon";
import "../styles/overview-team-mirror.css";
import "../styles/overview-planning.css";

export function OverviewPage() {
  const { dataset, state } = useRunView();
  const activeLinks = selectActiveSoulLinks(state);
  const lostLinks = selectLostSoulLinks(state);
  const visiblePokemon = [...state.pokemon.values()];
  const planningStage = dataset.run.status === "planning" || dataset.pokemon.length === 0;
  const players = dataset.run.playerIds
    .map((playerId) => dataset.players.find((player) => player.id === playerId))
    .filter((player): player is Player => player !== undefined);

  return (
    <div className="page-stack overview-page">
      <section
        className={`run-hero run-hero--overview run-hero--compact${planningStage ? " run-hero--planning" : ""}`}
      >
        <div>
          <p className="eyebrow">HeartGold / SoulSilver Soul Link</p>
          <h1>{dataset.run.title}</h1>
          <p className="hero-copy">
            {planningStage
              ? "Welcome to the Soul Link companion. The run has not started airing yet, so there are no catches or results to reveal. The site is live early for player information, rules and encounter planning."
              : "Follow the run without getting ahead: current teams, linked catches, major events, encounter planning, and the rules that keep the Soul Link together."}
          </p>
        </div>
      </section>

      {planningStage ? <PlanningState /> : null}

      <section className="run-profile-section">
        <div className="section-heading">
          <p className="eyebrow">The run</p>
          <h2>Players, current teams &amp; badge case</h2>
        </div>

        <div className="run-profile-board">
          {players.map((player, index) => {
            const party = selectPartyForPlayer(state, player.id);
            const side = index === 0 ? "gold" : "silver";

            return (
              <article className={`run-player-column run-player-column--${side}`} key={player.id}>
                <PlayerProfileCard
                  player={player}
                  partySize={party.length}
                  side={side}
                  planningStage={planningStage}
                />

                <div
                  className={`run-player-column__team${planningStage ? " run-player-column__team--planning" : ""}`}
                >
                  <div className="run-player-column__heading">
                    <span>{planningStage ? "Run status" : "Current team"}</span>
                    <strong>{planningStage ? "Not started" : `${party.length}/6`}</strong>
                  </div>

                  <div className="team-list">
                    {party.length ? (
                      party.map((pokemon) => (
                        <TeamPokemonCard key={pokemon.id} pokemon={pokemon} side={side} />
                      ))
                    ) : (
                      <div className={`team-empty${planningStage ? " team-empty--planning" : ""}`}>
                        {planningStage
                          ? "No teams yet, as there are no pokemon caught yet!"
                          : "No party Pokémon visible at this spoiler point."}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}

          <div className="run-profile-board__badges">
            <div className="section-heading section-heading--split">
              <div>
                <p className="eyebrow">Johto challenge</p>
                <h3>Gym badge case</h3>
              </div>
              <span className="section-stat">
                {planningStage ? "Waiting for the run" : `${state.earnedBadgeIds.size}/8 earned`}
              </span>
            </div>
            <BadgeCase earnedBadgeIds={state.earnedBadgeIds} />
          </div>
        </div>
      </section>

      {!planningStage ? (
        <section className="stat-grid" aria-label="Run statistics">
          <article>
            <strong>{activeLinks.length}</strong>
            <span>Active links</span>
          </article>
          <article>
            <strong>{lostLinks.length}</strong>
            <span>Lost links</span>
          </article>
          <article>
            <strong>{visiblePokemon.length}</strong>
            <span>Known Pokémon</span>
          </article>
          <article>
            <strong>{state.processedEventIds.length}</strong>
            <span>Visible events</span>
          </article>
        </section>
      ) : null}

      <section className="overview-destinations" aria-label="Explore the companion">
        <DestinationPanel
          to="/timeline"
          eyebrow={planningStage ? "Coming with Episode 1" : "Watch the story"}
          title="Timeline"
          description={
            planningStage
              ? "The episode-by-episode timeline will begin filling in once the Soul Link starts airing."
              : "Episode-by-episode catches, evolutions, battles, deaths and the moments that shaped the run."
          }
          className="overview-destination--timeline"
        />
        <DestinationPanel
          to="/pokemon"
          eyebrow={planningStage ? "Waiting for first catches" : "Follow every pair"}
          title="Soul Link Roster"
          description={
            planningStage
              ? "Linked Pokémon pairs will appear here as soon as the first encounters are part of the public run."
              : "Every linked catch side by side, with current status, typing and complete individual histories."
          }
          className="overview-destination--roster"
        />
        <DestinationPanel
          to="/map"
          eyebrow={planningStage ? "Plan ahead" : "Plan the next catch"}
          title="Encounter Map"
          description={
            planningStage
              ? "Explore Johto's encounter locations and progression requirements before the first catches happen."
              : "See what is reachable now, inspect unused encounters, and override progression while recording."
          }
          className="overview-destination--map"
        />
      </section>
    </div>
  );
}

function PlanningState() {
  return (
    <section className="overview-planning-state" aria-labelledby="overview-planning-title">
      <div>
        <p className="eyebrow">Run status</p>
        <h2 id="overview-planning-title">The Soul Link has not started yet</h2>
        <p>
          Whilst the nuzlocke has not begun yet, this website is already ready to go! As soon as the
          first episode airs, this page will switch over to the nuzlocke mode, and will keep track
          of all pokemon, events and other milestones that will happen!
        </p>
      </div>
      <div className="overview-planning-state__actions">
        <Link className="button" to="/rules">
          Read the rules
        </Link>
        <Link className="button" to="/map">
          Explore the encounter map
        </Link>
      </div>
    </section>
  );
}

function PlayerProfileCard({
  player,
  partySize,
  side,
  planningStage,
}: {
  player: Player;
  partySize: number;
  side: "gold" | "silver";
  planningStage: boolean;
}) {
  const content = (
    <>
      <div className="player-profile-card__avatar">
        {player.avatarUrl ? (
          <img src={player.avatarUrl} alt="" />
        ) : (
          <span>{player.displayName.charAt(0)}</span>
        )}
      </div>
      <div className="player-profile-card__copy">
        <span>{player.gameVersionId === "heartgold" ? "HeartGold" : "SoulSilver"}</span>
        <h3>{player.displayName}</h3>
        {!planningStage ? <p>{partySize}/6 Pokémon currently in the visible party</p> : null}
      </div>
      {player.channelUrl ? <span className="player-profile-card__cta">Channel ↗</span> : null}
    </>
  );

  const className = `player-profile-card player-profile-card--${side}`;

  return player.channelUrl ? (
    <a className={className} href={player.channelUrl} target="_blank" rel="noreferrer">
      {content}
    </a>
  ) : (
    <div className={className}>{content}</div>
  );
}

function TeamPokemonCard({ pokemon, side }: { pokemon: PokemonState; side: "gold" | "silver" }) {
  const species = getSpeciesName(pokemon.currentSpeciesId);

  return (
    <Link
      className={`team-pokemon-card team-pokemon-card--${side}${pokemon.source.shiny ? " team-pokemon-card--shiny" : ""}`}
      to={`/pokemon/${pokemon.id}`}
    >
      <div className="team-pokemon-card__sprite">
        <img
          src={getHgssSpriteUrl(pokemon.currentSpeciesId, pokemon.source.shiny)}
          alt=""
          loading="lazy"
        />
        {pokemon.source.shiny ? <span aria-label="Shiny Pokémon">✨</span> : null}
      </div>
      <div className="team-pokemon-card__copy">
        <strong>{pokemon.currentNickname ?? species}</strong>
        {pokemon.currentNickname ? <small>{species}</small> : null}
        <PokemonTypeChips speciesId={pokemon.currentSpeciesId} />
      </div>
      {pokemon.currentLevel ? (
        <span className="team-pokemon-card__level">Lv. {pokemon.currentLevel}</span>
      ) : null}
    </Link>
  );
}

function DestinationPanel({
  to,
  eyebrow,
  title,
  description,
  className,
}: {
  to: string;
  eyebrow: string;
  title: string;
  description: string;
  className: string;
}) {
  return (
    <Link className={`overview-destination ${className}`} to={to}>
      <span className="overview-destination__copy">
        <small>{eyebrow}</small>
        <strong>{title}</strong>
        <span>{description}</span>
      </span>
      <b aria-hidden="true">→</b>
    </Link>
  );
}
