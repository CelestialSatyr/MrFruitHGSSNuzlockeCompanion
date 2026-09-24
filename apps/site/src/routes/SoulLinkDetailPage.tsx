import { selectSoulLinkHistory } from "@nuzlocke/core";
import { Link, useParams } from "react-router";
import { EventCard } from "../components/EventCard";
import { SoulLinkCard } from "../components/SoulLinkCard";
import { SpoilerGate } from "../components/SpoilerGate";
import { useRunView } from "../context/RunViewContext";

export function SoulLinkDetailPage() {
  const { linkId } = useParams();
  const { visibleRunViews } = useRunView();
  const runView = visibleRunViews.find((entry) =>
    entry.dataset.soulLinks.some((link) => link.id === linkId),
  );
  if (!runView)
    return (
      <section className="empty-state">
        <h1>Soul Link not found</h1>
      </section>
    );

  const { dataset, state } = runView;
  const authored = dataset.soulLinks.find((entry) => entry.id === linkId);
  if (!authored)
    return (
      <section className="empty-state">
        <h1>Soul Link not found</h1>
      </section>
    );

  const current = state.soulLinks.get(authored.id);
  if (!current) {
    const creation = dataset.events.find((event) => event.id === authored.createdByEventId);
    const episode = dataset.episodes.find((entry) => entry.id === creation?.episodeId);
    return <SpoilerGate revealEpisode={episode?.number ?? 1} />;
  }

  const history = selectSoulLinkHistory(dataset, state, current.id).filter(
    (event) => event.visibility?.soulLinkHistory !== false,
  );

  return (
    <div className="page-stack page-stack--tight">
      <Link className="back-link" to="/">
        ← Overview
      </Link>
      <header className="page-heading">
        <div>
          <p className="eyebrow">Run {dataset.run.attemptNumber ?? 1} · Persistent pair</p>
          <h1>{current.id.replace("link_", "Soul Link #")}</h1>
          <p>The complete visible history of this linked pair.</p>
        </div>
      </header>
      <SoulLinkCard link={current} dataset={dataset} pokemonById={state.pokemon} />
      <section>
        <div className="section-heading">
          <p className="eyebrow">Shared history</p>
          <h2>Events</h2>
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
