import { getEventReferences, selectTimelineEpisodeGroups, type RunEvent } from "@nuzlocke/core";
import { useMemo, useState } from "react";
import { EventCard } from "../components/EventCard";
import { useRunView } from "../context/RunViewContext";
import { getEventLocationName } from "../lib/encounter-locations";
import { getPlayerTheme } from "../lib/player-theme";
import { getSpeciesName } from "../lib/pokemon";
import { matchesSearch, normalizeSearchText } from "../lib/search";

function buildEventSearchText(
  event: RunEvent,
  dataset: ReturnType<typeof useRunView>["dataset"],
  state: ReturnType<typeof useRunView>["state"],
): string {
  const values: string[] = [
    event.type,
    event.title ?? "",
    event.description ?? "",
    getEventLocationName(event) ?? "",
    JSON.stringify(event) ?? "",
  ];

  for (const assignment of event.tags ?? []) {
    const tag = dataset.tags.find((entry) => entry.id === assignment.tagId);
    if (tag) values.push(tag.label);
    if (assignment.detail) values.push(assignment.detail);
  }

  for (const annotation of event.annotations ?? []) {
    values.push(annotation.kind, annotation.text);
  }

  const references = getEventReferences(event);
  for (const pokemonId of references.pokemonIds) {
    const pokemon = state.pokemon.get(pokemonId);
    if (!pokemon) continue;
    values.push(
      pokemon.currentNickname ?? "",
      getSpeciesName(pokemon.currentSpeciesId),
      getSpeciesName(pokemon.source.initialSpeciesId),
    );
    const owner = dataset.players.find((player) => player.id === pokemon.playerId);
    if (owner) values.push(owner.displayName, owner.shortName ?? "");
  }

  if (event.type === "encounter") {
    for (const outcome of event.outcomes) {
      if (outcome.speciesId) values.push(getSpeciesName(outcome.speciesId));
      if (outcome.result === "caught" && outcome.nickname) values.push(outcome.nickname);
      const player = dataset.players.find((entry) => entry.id === outcome.playerId);
      if (player) values.push(player.displayName, player.shortName ?? "");
    }
  }

  return values.join(" ");
}

export function TimelinePage() {
  const { dataset, viewEpisodes, state, visibleThroughEpisode, timelineOrder, setTimelineOrder } =
    useRunView();
  const [searchQuery, setSearchQuery] = useState("");
  const visibleGroups = selectTimelineEpisodeGroups(dataset, state, timelineOrder);
  const groupByEpisode = new Map(visibleGroups.map((group) => [group.episode.number, group]));
  const episodes = [...viewEpisodes].sort((a, b) => a.number - b.number);
  if (timelineOrder === "newest-first") episodes.reverse();

  const newestVisible = Math.max(0, ...visibleGroups.map((group) => group.episode.number));
  const searchActive = normalizeSearchText(searchQuery).length > 0;

  const eventSearchText = useMemo(() => {
    return new Map(
      visibleGroups.flatMap((group) =>
        group.events.map(
          (event) => [event.id, buildEventSearchText(event, dataset, state)] as const,
        ),
      ),
    );
  }, [dataset, state, visibleGroups]);

  let matchedEpisodeCount = 0;

  return (
    <div className="page-stack page-stack--tight">
      <header className="page-heading timeline-heading">
        <div>
          <p className="eyebrow">Run history</p>
          <h1>Timeline</h1>
          <div className="timeline-player-legend">
            {dataset.run.playerIds.map((playerId, index) => {
              const player = dataset.players.find((entry) => entry.id === playerId);
              const theme = player ? getPlayerTheme(player) : undefined;
              return (
                <span
                  key={playerId}
                  className={theme ? `timeline-player-legend__${theme}` : undefined}
                >
                  {player?.displayName ?? `Player ${index + 1}`}
                </span>
              );
            })}
          </div>
        </div>
        <div className="timeline-controls">
          <label className="timeline-search-control">
            <span>Search timeline</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Pokémon, route, battle…"
              autoComplete="off"
            />
          </label>
          <label className="select-control">
            Order
            <select
              value={timelineOrder}
              onChange={(event) =>
                setTimelineOrder(event.target.value as "newest-first" | "chronological")
              }
            >
              <option value="newest-first">Newest episode first</option>
              <option value="chronological">Chronological</option>
            </select>
          </label>
        </div>
      </header>

      {searchActive ? (
        <div className="timeline-search-summary" aria-live="polite">
          Searching the visible timeline for <strong>“{searchQuery.trim()}”</strong>
        </div>
      ) : null}

      <div className="episode-list">
        {episodes.map((episode) => {
          const hidden = episode.number > visibleThroughEpisode;
          const group = groupByEpisode.get(episode.number);

          if (hidden) {
            if (searchActive) return null;
            return (
              <section className="episode-segment episode-segment--locked" key={episode.id}>
                <div>
                  <span className="episode-number">Episode {episode.number}</span>
                  <strong>Hidden by spoiler settings</strong>
                </div>
                <span aria-hidden="true">◇</span>
              </section>
            );
          }

          const visibleEvents = (group?.events ?? []).filter(
            (event) => event.type !== "level-milestone" && event.visibility?.runTimeline !== false,
          );
          const episodeSearchText = [
            `Episode ${episode.number}`,
            episode.titleOverride ?? "",
            episode.summary ?? "",
          ].join(" ");
          const episodeMatches = searchActive && matchesSearch(episodeSearchText, searchQuery);
          const matchingEvents = searchActive
            ? episodeMatches
              ? visibleEvents
              : visibleEvents.filter((event) =>
                  matchesSearch(eventSearchText.get(event.id) ?? "", searchQuery),
                )
            : visibleEvents;

          if (searchActive && !episodeMatches && matchingEvents.length === 0) return null;
          matchedEpisodeCount += 1;

          return (
            <details
              className="episode-segment"
              key={episode.id}
              open={searchActive || episode.number === newestVisible}
            >
              <summary>
                <div>
                  <span className="episode-number">Episode {episode.number}</span>
                  <strong>{episode.titleOverride ?? `Episode ${episode.number}`}</strong>
                  {searchActive ? (
                    <small className="episode-search-count">
                      {matchingEvents.length} matching event{matchingEvents.length === 1 ? "" : "s"}
                    </small>
                  ) : null}
                </div>
                <span className="episode-chevron" aria-hidden="true">
                  ⌄
                </span>
              </summary>
              <div className="episode-segment__content">
                {episode.summary ? <p className="episode-summary">{episode.summary}</p> : null}
                <div className="event-list">
                  {matchingEvents.map((event) => (
                    <EventCard key={event.id} event={event} dataset={dataset} state={state} />
                  ))}
                </div>
              </div>
            </details>
          );
        })}

        {searchActive && matchedEpisodeCount === 0 ? (
          <div className="timeline-search-empty">
            <strong>No matching timeline events</strong>
            <span>Try a Pokémon name, nickname, route, player, battle, tag, or event type.</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
