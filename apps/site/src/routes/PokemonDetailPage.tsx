import { selectPokemonHistory } from "@nuzlocke/core";
import { Link, useParams } from "react-router";
import { EventCard } from "../components/EventCard";
import { SoulLinkCard } from "../components/SoulLinkCard";
import { SpoilerGate } from "../components/SpoilerGate";
import { PokemonTypeChips } from "../components/PokemonTypeChips";
import { useRunView } from "../context/RunViewContext";
import { getOfficialArtworkUrl, getSpeciesName } from "../lib/pokemon";

export function PokemonDetailPage() {
  const { pokemonId } = useParams();
  const { visibleRunViews } = useRunView();
  const runView = visibleRunViews.find((entry) =>
    entry.dataset.pokemon.some((pokemon) => pokemon.id === pokemonId),
  );
  if (!runView) return <NotFound label="Pokémon" />;
  const { dataset, state } = runView;
  const authored = dataset.pokemon.find((entry) => entry.id === pokemonId);
  if (!authored) return <NotFound label="Pokémon" />;

  const current = state.pokemon.get(authored.id);
  if (!current) {
    const creation = dataset.events.find((event) => event.id === authored.createdByEventId);
    const episode = dataset.episodes.find((entry) => entry.id === creation?.episodeId);
    return <SpoilerGate revealEpisode={episode?.number ?? 1} />;
  }

  const player = dataset.players.find((entry) => entry.id === current.playerId);
  const species = getSpeciesName(current.currentSpeciesId);
  const history = selectPokemonHistory(dataset, state, current.id).filter(
    (event) => event.visibility?.pokemonHistory !== false,
  );
  const link = current.soulLinkId ? state.soulLinks.get(current.soulLinkId) : undefined;
  const shiny = current.source.shiny;
  const playerSide = dataset.run.playerIds[0] === current.playerId ? "gold" : "silver";

  return (
    <div className="page-stack page-stack--tight">
      <Link className="back-link" to="/pokemon">
        ← All Pokémon
      </Link>
      <section
        className={`pokemon-hero pokemon-hero--${current.lifeStatus} pokemon-hero--${playerSide}${shiny ? " pokemon-hero--shiny" : ""}`}
      >
        <div className="pokemon-hero__art">
          <img
            src={getOfficialArtworkUrl(current.currentSpeciesId, shiny)}
            alt={`${species} official artwork`}
          />
        </div>
        <div className="pokemon-hero__copy">
          <p className="eyebrow">
            Run {dataset.run.attemptNumber ?? 1} · {player?.displayName}
          </p>
          <h1>{current.currentNickname ?? species}</h1>
          {current.currentNickname ? <p className="pokemon-hero__species">{species}</p> : null}
          <PokemonTypeChips speciesId={current.currentSpeciesId} />
          {shiny ? <p className="hero-callout">✨ Shiny encounter</p> : null}
          <div className="profile-facts">
            <span>
              <small>Status</small>
              <strong>{current.lifeStatus.replaceAll("-", " ")}</strong>
            </span>
            <span>
              <small>Placement</small>
              <strong>{current.placement}</strong>
            </span>
            {current.currentLevel ? (
              <span>
                <small>Last known level</small>
                <strong>{current.currentLevel}</strong>
              </span>
            ) : null}
            {current.natureId ? (
              <span>
                <small>Nature</small>
                <strong>{current.natureId.replaceAll("-", " ")}</strong>
              </span>
            ) : null}
            {current.abilityId ? (
              <span>
                <small>Ability</small>
                <strong>{current.abilityId.replaceAll("-", " ")}</strong>
              </span>
            ) : null}
            <span>
              <small>History entries</small>
              <strong>{history.length}</strong>
            </span>
          </div>
        </div>
      </section>

      {link ? (
        <section>
          <div className="section-heading">
            <p className="eyebrow">Linked fate</p>
            <h2>Soul Link</h2>
          </div>
          <SoulLinkCard link={link} dataset={dataset} pokemonById={state.pokemon} />
        </section>
      ) : null}

      <section>
        <div className="section-heading">
          <p className="eyebrow">Biography</p>
          <h2>History</h2>
        </div>
        <div className="history-rail">
          {history.map((event) => (
            <EventCard key={event.id} event={event} dataset={dataset} state={state} compact />
          ))}
        </div>
      </section>
    </div>
  );
}

function NotFound({ label }: { label: string }) {
  return (
    <section className="empty-state">
      <h1>{label} not found</h1>
      <p>The requested record does not exist in the published dataset.</p>
    </section>
  );
}
