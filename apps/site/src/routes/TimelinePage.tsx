import { selectTimelineEpisodeGroups } from "@nuzlocke/core";
import { EventCard } from "../components/EventCard";
import { useRunView } from "../context/RunViewContext";

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
            <span className="timeline-player-legend__gold">
              {dataset.players.find((player) => player.id === dataset.run.playerIds[0])
                ?.displayName ?? "Player 1"}
            </span>
            <span className="timeline-player-legend__silver">
              {dataset.players.find((player) => player.id === dataset.run.playerIds[1])
                ?.displayName ?? "Player 2"}
            </span>
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
                    .filter((event) => event.visibility?.runTimeline !== false)
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
