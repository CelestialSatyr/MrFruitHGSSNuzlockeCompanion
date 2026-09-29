import { selectTimelineEpisodeGroups } from "@nuzlocke/core";
import { EventCard } from "../components/EventCard";
import { useRunView } from "../context/RunViewContext";
import { getPlayerTheme } from "../lib/player-theme";

export function TimelinePage() {
  const { dataset, viewEpisodes, state, visibleThroughEpisode, timelineOrder, setTimelineOrder } =
    useRunView();
  const visibleGroups = selectTimelineEpisodeGroups(dataset, state, timelineOrder);
  const groupByEpisode = new Map(visibleGroups.map((group) => [group.episode.number, group]));
  const episodes = [...viewEpisodes].sort((a, b) => a.number - b.number);
  if (timelineOrder === "newest-first") episodes.reverse();

  const newestVisible = Math.max(0, ...visibleGroups.map((group) => group.episode.number));

  return (
    <div className="page-stack page-stack--tight">
      <header className="page-heading">
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
      </header>

      <div className="episode-list">
        {episodes.map((episode) => {
          const hidden = episode.number > visibleThroughEpisode;
          const group = groupByEpisode.get(episode.number);
          if (hidden) {
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

          return (
            <details
              className="episode-segment"
              key={episode.id}
              open={episode.number === newestVisible}
            >
              <summary>
                <div>
                  <span className="episode-number">Episode {episode.number}</span>
                  <strong>{episode.titleOverride ?? `Episode ${episode.number}`}</strong>
                </div>
                <span className="episode-chevron" aria-hidden="true">
                  ⌄
                </span>
              </summary>
              <div className="episode-segment__content">
                {episode.summary ? <p className="episode-summary">{episode.summary}</p> : null}
                <div className="event-list">
                  {(group?.events ?? [])
                    .filter(
                      (event) =>
                        event.type !== "level-milestone" && event.visibility?.runTimeline !== false,
                    )
                    .map((event) => (
                      <EventCard key={event.id} event={event} dataset={dataset} state={state} />
                    ))}
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
