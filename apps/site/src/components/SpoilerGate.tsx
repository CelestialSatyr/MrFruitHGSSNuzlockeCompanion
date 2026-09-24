import { useRunView } from "../context/RunViewContext";

export function SpoilerGate({ revealEpisode }: { revealEpisode: number }) {
  const { visibleThroughEpisode, revealThroughEpisode } = useRunView();

  return (
    <section className="spoiler-gate">
      <span className="spoiler-gate__icon" aria-hidden="true">
        ◈
      </span>
      <p className="eyebrow">Spoiler protection</p>
      <h1>This content is beyond your current episode limit.</h1>
      <p>You are currently viewing the run through Episode {visibleThroughEpisode}.</p>
      <button
        className="button button--primary"
        type="button"
        onClick={() => revealThroughEpisode(revealEpisode)}
      >
        Reveal linked content
      </button>
    </section>
  );
}
