import type { Player, PokemonState, RunDataset, SoulLinkState } from "@nuzlocke/core";
import { Link } from "react-router";
import { PokemonTypeChips } from "../components/PokemonTypeChips";
import { useRunView } from "../context/RunViewContext";
import { getHgssSpriteUrl, getSpeciesName } from "../lib/pokemon";

interface PairRow {
  id: string;
  left?: PokemonState;
  right?: PokemonState;
  link?: SoulLinkState;
  order: number;
}

export function PokemonIndexPage() {
  const { dataset, state } = useRunView();
  const [leftPlayerId, rightPlayerId] = dataset.run.playerIds;
  const leftPlayer = dataset.players.find((player) => player.id === leftPlayerId);
  const rightPlayer = dataset.players.find((player) => player.id === rightPlayerId);
  const eventOrder = buildEventOrder(dataset);

  const rows: PairRow[] = [...state.soulLinks.values()].map((link) => {
    const pokemon = link.pokemonIds
      .map((id) => state.pokemon.get(id))
      .filter((entry): entry is PokemonState => entry !== undefined);
    const left = pokemon.find((entry) => entry.playerId === leftPlayerId);
    const right = pokemon.find((entry) => entry.playerId === rightPlayerId);
    return {
      id: link.id,
      ...(left ? { left } : {}),
      ...(right ? { right } : {}),
      link,
      order: eventOrder.get(link.createdByEventId) ?? Number.MAX_SAFE_INTEGER,
    };
  });

  const pairedPokemonIds = new Set(
    rows.flatMap((row) =>
      [row.left?.id, row.right?.id].filter((id): id is PokemonState["id"] => id !== undefined),
    ),
  );
  const unlinked = [...state.pokemon.values()].filter(
    (pokemon) => !pairedPokemonIds.has(pokemon.id),
  );
  const unlinkedByCreation = unlinked.sort(
    (a, b) =>
      (eventOrder.get(a.createdByEventId) ?? Number.MAX_SAFE_INTEGER) -
      (eventOrder.get(b.createdByEventId) ?? Number.MAX_SAFE_INTEGER),
  );

  for (const pokemon of unlinkedByCreation) {
    rows.push({
      id: pokemon.id,
      ...(pokemon.playerId === leftPlayerId ? { left: pokemon } : { right: pokemon }),
      order: eventOrder.get(pokemon.createdByEventId) ?? Number.MAX_SAFE_INTEGER,
    });
  }

  rows.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

  return (
    <div className="page-stack page-stack--tight">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Linked history</p>
          <h1>Soul Link Roster</h1>
          <p>
            Every visible catch is arranged beside its Soul Link partner. The left column belongs to{" "}
            {leftPlayer?.displayName ?? "Player one"}; the right belongs to{" "}
            {rightPlayer?.displayName ?? "Player two"}.
          </p>
        </div>
      </header>

      <div className="pokemon-pair-board">
        <div className="pokemon-pair-board__heading pokemon-pair-board__heading--left">
          <PlayerHeading player={leftPlayer} side="left" />
        </div>
        <div
          className="pokemon-pair-board__heading pokemon-pair-board__heading--link"
          aria-hidden="true"
        >
          Soul Link
        </div>
        <div className="pokemon-pair-board__heading pokemon-pair-board__heading--right">
          <PlayerHeading player={rightPlayer} side="right" />
        </div>

        {rows.length ? (
          rows.map((row) => (
            <PokemonPairRow
              key={row.id}
              row={row}
              leftPlayer={leftPlayer}
              rightPlayer={rightPlayer}
            />
          ))
        ) : (
          <div className="pokemon-pair-empty">
            No Pokémon are visible at this spoiler point yet.
          </div>
        )}
      </div>
    </div>
  );
}

function buildEventOrder(dataset: RunDataset) {
  const episodeById = new Map(dataset.episodes.map((episode) => [episode.id, episode.number]));
  const ordered = [...dataset.events].sort((a, b) => {
    const episodeA = episodeById.get(a.episodeId) ?? 0;
    const episodeB = episodeById.get(b.episodeId) ?? 0;
    return episodeA - episodeB || a.sequence - b.sequence || a.id.localeCompare(b.id);
  });
  return new Map(ordered.map((event, index) => [event.id, index]));
}

function PlayerHeading({ player, side }: { player: Player | undefined; side: "left" | "right" }) {
  return (
    <div className={`pokemon-owner-heading pokemon-owner-heading--${side}`}>
      <div className="pokemon-owner-heading__avatar">
        {player?.avatarUrl ? (
          <img src={player.avatarUrl} alt="" />
        ) : (
          <span>{player?.displayName.charAt(0) ?? "?"}</span>
        )}
      </div>
      <div>
        <small>
          {player?.gameVersionId === "heartgold"
            ? "HeartGold"
            : player?.gameVersionId === "soulsilver"
              ? "SoulSilver"
              : "Player"}
        </small>
        <strong>{player?.displayName ?? (side === "left" ? "Player one" : "Player two")}</strong>
      </div>
    </div>
  );
}

function PokemonPairRow({
  row,
  leftPlayer,
  rightPlayer,
}: {
  row: PairRow;
  leftPlayer: Player | undefined;
  rightPlayer: Player | undefined;
}) {
  const status = row.link?.status ?? "unlinked";
  return (
    <article className={`pokemon-pair-row pokemon-pair-row--${status}`}>
      <div className="pokemon-pair-row__member pokemon-pair-row__member--left">
        {row.left ? (
          <PokemonHistoryCard pokemon={row.left} player={leftPlayer} />
        ) : (
          <EmptyPairCell label="No linked Pokémon" />
        )}
      </div>

      <div className="pokemon-pair-row__bridge">
        <span aria-hidden="true" />
        {row.link ? (
          <Link to={`/soul-links/${row.link.id}`}>
            {row.link.status === "active"
              ? "Active link"
              : row.link.status === "lost"
                ? "Link lost"
                : "Retired"}
          </Link>
        ) : (
          <strong>Unlinked</strong>
        )}
        <span aria-hidden="true" />
      </div>

      <div className="pokemon-pair-row__member pokemon-pair-row__member--right">
        {row.right ? (
          <PokemonHistoryCard pokemon={row.right} player={rightPlayer} />
        ) : (
          <EmptyPairCell label="No linked Pokémon" />
        )}
      </div>
    </article>
  );
}

function PokemonHistoryCard({
  pokemon,
  player,
}: {
  pokemon: PokemonState;
  player: Player | undefined;
}) {
  const species = getSpeciesName(pokemon.currentSpeciesId);
  return (
    <Link
      className={`pokemon-history-card pokemon-history-card--${pokemon.lifeStatus}${pokemon.source.shiny ? " pokemon-history-card--shiny" : ""}`}
      to={`/pokemon/${pokemon.id}`}
    >
      <div className="pokemon-history-card__art">
        <img
          src={getHgssSpriteUrl(pokemon.currentSpeciesId, pokemon.source.shiny)}
          alt=""
          loading="lazy"
        />
        {pokemon.source.shiny ? <span aria-label="Shiny Pokémon">✨</span> : null}
      </div>
      <div className="pokemon-history-card__copy">
        <small>{player?.shortName ?? player?.displayName}</small>
        <h2>{pokemon.currentNickname ?? species}</h2>
        {pokemon.currentNickname ? <p>{species}</p> : null}
        <PokemonTypeChips speciesId={pokemon.currentSpeciesId} />
        <div className="pokemon-history-card__meta">
          <span>{pokemon.lifeStatus.replaceAll("-", " ")}</span>
          <span>{pokemon.placement}</span>
          {pokemon.currentLevel ? <span>Lv. {pokemon.currentLevel}</span> : null}
        </div>
      </div>
    </Link>
  );
}

function EmptyPairCell({ label }: { label: string }) {
  return <div className="pokemon-history-card pokemon-history-card--empty">{label}</div>;
}
