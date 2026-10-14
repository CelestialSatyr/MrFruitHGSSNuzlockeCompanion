import type { Player, PokemonState, RunDataset, SoulLinkState } from "@nuzlocke/core";
import { useState } from "react";
import { Link } from "react-router";
import { PokemonTypeChips } from "../components/PokemonTypeChips";
import { useRunView } from "../context/RunViewContext";
import { usePokemonTypeMap } from "../hooks/usePokemonTypes";
import { getPokemonCatchLocationName } from "../lib/encounter-locations";
import { getHgssSpriteUrl, getSpeciesName } from "../lib/pokemon";
import { getPlayerGameLabel, getPlayerTheme, type PlayerTheme } from "../lib/player-theme";
import { matchesSearch, normalizeSearchText } from "../lib/search";

interface PairRow {
  id: string;
  left?: PokemonState;
  right?: PokemonState;
  link?: SoulLinkState;
  order: number;
}

export function PokemonIndexPage() {
  const { dataset, state } = useRunView();
  const [searchQuery, setSearchQuery] = useState("");
  const [leftPlayerId, rightPlayerId] = dataset.run.playerIds;
  const leftPlayer = dataset.players.find((player) => player.id === leftPlayerId);
  const rightPlayer = dataset.players.find((player) => player.id === rightPlayerId);
  const leftTheme = leftPlayer ? getPlayerTheme(leftPlayer) : undefined;
  const rightTheme = rightPlayer ? getPlayerTheme(rightPlayer) : undefined;
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

  const speciesIds = [
    ...new Set([...state.pokemon.values()].map((pokemon) => pokemon.currentSpeciesId)),
  ];
  const { typesBySpecies, loading: typesLoading } = usePokemonTypeMap(speciesIds);
  const searchActive = normalizeSearchText(searchQuery).length > 0;
  const visibleRows = searchActive
    ? rows.filter((row) =>
        matchesSearch(
          [row.left, row.right]
            .filter((pokemon): pokemon is PokemonState => pokemon !== undefined)
            .flatMap((pokemon) => {
              const player = dataset.players.find((entry) => entry.id === pokemon.playerId);
              const types = typesBySpecies.get(pokemon.currentSpeciesId) ?? [];
              return [
                pokemon.currentNickname ?? "",
                getSpeciesName(pokemon.currentSpeciesId),
                getSpeciesName(pokemon.source.initialSpeciesId),
                player?.displayName ?? "",
                player?.shortName ?? "",
                getPokemonCatchLocationName(dataset, pokemon) ?? "",
                ...types,
              ];
            })
            .concat(row.link?.status ?? "unlinked", "soul link", "pair")
            .join(" "),
          searchQuery,
        ),
      )
    : rows;

  return (
    <div className="page-stack page-stack--tight">
      <header className="page-heading roster-heading">
        <div>
          <p className="eyebrow">Linked history</p>
          <h1>Soul Link Roster</h1>
          <p>
            Every visible catch is arranged beside its Soul Link partner. The left column belongs to{" "}
            {leftPlayer?.displayName ?? "Player one"}; the right belongs to{" "}
            {rightPlayer?.displayName ?? "Player two"}.
          </p>
        </div>
        <label className="roster-search-control">
          <span>Search roster</span>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Nickname, species, type…"
            autoComplete="off"
          />
        </label>
      </header>

      {searchActive ? (
        <div className="roster-search-summary" aria-live="polite">
          Showing <strong>{visibleRows.length}</strong> of {rows.length} linked row
          {rows.length === 1 ? "" : "s"} for <strong>“{searchQuery.trim()}”</strong>
          {typesLoading ? <span> · Loading typing data…</span> : null}
        </div>
      ) : null}

      <div className="pokemon-pair-board">
        <div
          className={`pokemon-pair-board__heading pokemon-pair-board__heading--left${leftTheme ? ` pokemon-pair-board__heading--${leftTheme}` : ""}`}
        >
          <PlayerHeading player={leftPlayer} side="left" />
        </div>
        <div
          className="pokemon-pair-board__heading pokemon-pair-board__heading--link"
          aria-hidden="true"
        >
          Soul Link
        </div>
        <div
          className={`pokemon-pair-board__heading pokemon-pair-board__heading--right${rightTheme ? ` pokemon-pair-board__heading--${rightTheme}` : ""}`}
        >
          <PlayerHeading player={rightPlayer} side="right" />
        </div>

        {visibleRows.length ? (
          visibleRows.map((row) => (
            <PokemonPairRow
              key={row.id}
              row={row}
              leftPlayer={leftPlayer}
              rightPlayer={rightPlayer}
              dataset={dataset}
            />
          ))
        ) : (
          <div className="pokemon-pair-empty">
            {searchActive
              ? "No Soul Link pairs match that roster search."
              : "No Pokémon are visible at this spoiler point yet."}
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
  const theme = player ? getPlayerTheme(player) : undefined;

  return (
    <div
      className={`pokemon-owner-heading pokemon-owner-heading--${side}${theme ? ` pokemon-owner-heading--${theme}` : ""}`}
    >
      <div className="pokemon-owner-heading__avatar">
        {player?.avatarUrl ? (
          <img src={player.avatarUrl} alt="" />
        ) : (
          <span>{player?.displayName.charAt(0) ?? "?"}</span>
        )}
      </div>
      <div>
        <small>{player ? getPlayerGameLabel(player) : "Player"}</small>
        <strong>{player?.displayName ?? (side === "left" ? "Player one" : "Player two")}</strong>
      </div>
    </div>
  );
}

function PokemonPairRow({
  row,
  leftPlayer,
  rightPlayer,
  dataset,
}: {
  row: PairRow;
  leftPlayer: Player | undefined;
  rightPlayer: Player | undefined;
  dataset: RunDataset;
}) {
  const status = row.link?.status ?? "unlinked";
  const leftTheme = leftPlayer ? getPlayerTheme(leftPlayer) : undefined;
  const rightTheme = rightPlayer ? getPlayerTheme(rightPlayer) : undefined;
  const catchLocations = [row.left, row.right]
    .filter((pokemon): pokemon is PokemonState => pokemon !== undefined)
    .map((pokemon) => getPokemonCatchLocationName(dataset, pokemon))
    .filter((location): location is string => Boolean(location));
  const catchLocation = [...new Set(catchLocations)].join(" / ");

  return (
    <article className={`pokemon-pair-row pokemon-pair-row--${status}`}>
      <div
        className={`pokemon-pair-row__member pokemon-pair-row__member--left${leftTheme ? ` pokemon-pair-row__member--${leftTheme}` : ""}`}
      >
        {row.left ? (
          <PokemonHistoryCard pokemon={row.left} player={leftPlayer} />
        ) : (
          <EmptyPairCell label="No linked Pokémon" />
        )}
      </div>

      <div className="pokemon-pair-row__bridge">
        <span aria-hidden="true" />
        <div className="pokemon-pair-row__bridge-copy">
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
          {catchLocation ? <small>{catchLocation}</small> : null}
        </div>
        <span aria-hidden="true" />
      </div>

      <div
        className={`pokemon-pair-row__member pokemon-pair-row__member--right${rightTheme ? ` pokemon-pair-row__member--${rightTheme}` : ""}`}
      >
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
  const theme: PlayerTheme | undefined = player ? getPlayerTheme(player) : undefined;

  return (
    <Link
      className={`pokemon-history-card pokemon-history-card--${pokemon.lifeStatus}${theme ? ` pokemon-history-card--${theme}` : ""}${pokemon.source.shiny ? " pokemon-history-card--shiny" : ""}`}
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
        </div>
      </div>
    </Link>
  );
}

function EmptyPairCell({ label }: { label: string }) {
  return <div className="pokemon-history-card pokemon-history-card--empty">{label}</div>;
}
