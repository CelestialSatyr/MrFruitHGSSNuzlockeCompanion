import { useEffect, useState } from "react";
import { useRunView } from "../context/RunViewContext";

export function SpoilerWelcomeDialog() {
  const {
    allViewEpisodes,
    spoilerEpisode,
    spoilerPromptOpen,
    askSpoilerPromptEachVisit,
    completeSpoilerPrompt,
  } = useRunView();
  const [episode, setEpisode] = useState(spoilerEpisode ?? 0);
  const [askAgain, setAskAgain] = useState(askSpoilerPromptEachVisit);

  useEffect(() => {
    if (!spoilerPromptOpen) return;
    setEpisode(spoilerEpisode ?? 0);
    setAskAgain(askSpoilerPromptEachVisit);
  }, [askSpoilerPromptEachVisit, spoilerEpisode, spoilerPromptOpen]);

  useEffect(() => {
    if (!spoilerPromptOpen || typeof document === "undefined") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [spoilerPromptOpen]);

  if (!spoilerPromptOpen) return null;

  const availableEpisodes = [...allViewEpisodes].sort((a, b) => a.number - b.number);

  return (
    <div className="spoiler-welcome-backdrop">
      <section
        className="spoiler-welcome-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="spoiler-welcome-title"
        aria-describedby="spoiler-welcome-description"
      >
        <div className="spoiler-welcome-icon" aria-hidden="true">
          ◉
        </div>
        <p className="eyebrow">Spoiler protection</p>
        <h1 id="spoiler-welcome-title">Where are you in the Soul Link?</h1>
        <p id="spoiler-welcome-description">
          Choose the latest episode you have completely finished watching. The companion will
          reconstruct everything—teams, Pokémon, runs, map state, deaths and highlights—only up to
          that point.
        </p>

        <label className="spoiler-welcome-select">
          <span>Latest episode finished</span>
          <select
            value={episode}
            onChange={(event) => setEpisode(Number(event.target.value))}
            autoFocus
          >
            <option value={0}>I haven&apos;t started yet</option>
            {availableEpisodes.map((entry) => (
              <option key={entry.id} value={entry.number}>
                Episode {entry.number}
              </option>
            ))}
          </select>
        </label>

        <label className="spoiler-welcome-check">
          <input
            type="checkbox"
            checked={askAgain}
            onChange={(event) => setAskAgain(event.target.checked)}
          />
          <span>
            <strong>Do you want me to ask you again next visit?</strong>
            <small>Useful if you expect new episodes to release before you return.</small>
          </span>
        </label>

        <button
          className="button button--primary spoiler-welcome-submit"
          onClick={() => completeSpoilerPrompt(episode, askAgain)}
        >
          Enter without spoilers
        </button>
        <small className="spoiler-welcome-note">
          You can change this at any time from the spoiler settings in the header.
        </small>
      </section>
    </div>
  );
}
