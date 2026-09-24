import { Link, useParams } from "react-router";
import { EventCard } from "../components/EventCard";
import { SpoilerGate } from "../components/SpoilerGate";
import { useRunView } from "../context/RunViewContext";

export function EventDetailPage() {
  const { eventId } = useParams();
  const { visibleRunViews } = useRunView();
  const runView = visibleRunViews.find((entry) =>
    entry.dataset.events.some((event) => event.id === eventId),
  );
  if (!runView)
    return (
      <section className="empty-state">
        <h1>Event not found</h1>
      </section>
    );

  const { dataset, state } = runView;
  const event = dataset.events.find((entry) => entry.id === eventId);
  if (!event)
    return (
      <section className="empty-state">
        <h1>Event not found</h1>
      </section>
    );

  const episode = dataset.episodes.find((entry) => entry.id === event.episodeId);
  const visible = state.processedEventIds.includes(event.id);
  if (!visible) return <SpoilerGate revealEpisode={episode?.number ?? 1} />;

  return (
    <div className="page-stack page-stack--tight event-detail-page">
      <Link className="back-link" to="/timeline">
        ← Timeline
      </Link>
      <header className="page-heading">
        <div>
          <p className="eyebrow">Shareable event · Run {dataset.run.attemptNumber ?? 1}</p>
          <h1>
            Episode {episode?.number} · Event {event.sequence}
          </h1>
          <p>
            This URL points directly to one run event while still respecting the viewer's spoiler
            setting.
          </p>
        </div>
      </header>
      <EventCard event={event} dataset={dataset} state={state} />
    </div>
  );
}
