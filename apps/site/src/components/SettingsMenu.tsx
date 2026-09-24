import { useState } from "react";
import { useRunView } from "../context/RunViewContext";

export function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const {
    allViewEpisodes,
    spoilerMode,
    spoilerEpisode,
    visibleThroughEpisode,
    latestPublishedEpisode,
    askSpoilerPromptEachVisit,
    setSpoilerMode,
    setSpoilerEpisode,
    setAskSpoilerPromptEachVisit,
  } = useRunView();

  const availableEpisodes = [...allViewEpisodes].sort((a, b) => a.number - b.number);

  const label =
    spoilerMode === "show-all"
      ? "All episodes shown"
      : spoilerMode === "hide-latest"
        ? "Latest episode hidden"
        : visibleThroughEpisode === 0
          ? "No episodes shown"
          : `Through Episode ${visibleThroughEpisode}`;

  return (
    <div className="settings-menu">
      <button
        className="spoiler-pill"
        type="button"
        aria-expanded={open}
        aria-controls="spoiler-settings-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">◉</span>
        {label}
      </button>

      {open ? (
        <div className="settings-panel" id="spoiler-settings-panel">
          <div className="settings-panel__heading">
            <div>
              <p className="eyebrow">Viewer settings</p>
              <strong>Spoiler protection</strong>
            </div>
            <button
              className="icon-button"
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close settings"
            >
              ×
            </button>
          </div>

          <label className="radio-row">
            <input
              type="radio"
              name="spoiler-mode"
              checked={spoilerMode === "hide-latest"}
              onChange={() => setSpoilerMode("hide-latest")}
            />
            <span>
              <strong>Hide latest episode</strong>
              <small>
                Currently shows through Episode {Math.max(0, latestPublishedEpisode - 1)}.
              </small>
            </span>
          </label>

          <label className="radio-row">
            <input
              type="radio"
              name="spoiler-mode"
              checked={spoilerMode === "show-all"}
              onChange={() => setSpoilerMode("show-all")}
            />
            <span>
              <strong>Show all episodes</strong>
              <small>Display every published event.</small>
            </span>
          </label>

          <label className="radio-row radio-row--stacked">
            <span className="radio-row__line">
              <input
                type="radio"
                name="spoiler-mode"
                checked={spoilerMode === "episode"}
                onChange={() => setSpoilerEpisode(spoilerEpisode ?? visibleThroughEpisode)}
              />
              <strong>I&apos;m on Episode…</strong>
            </span>
            <select
              aria-label="Current episode"
              value={
                spoilerMode === "episode"
                  ? (spoilerEpisode ?? visibleThroughEpisode)
                  : visibleThroughEpisode
              }
              onChange={(event) => setSpoilerEpisode(Number(event.target.value))}
            >
              <option value={0}>I haven&apos;t started yet</option>
              {availableEpisodes.map((episode) => (
                <option key={episode.id} value={episode.number}>
                  Episode {episode.number}
                </option>
              ))}
            </select>
          </label>

          <label className="settings-check-row">
            <input
              type="checkbox"
              checked={askSpoilerPromptEachVisit}
              onChange={(event) => setAskSpoilerPromptEachVisit(event.target.checked)}
            />
            <span>
              <strong>Ask me again next visit</strong>
              <small>
                Reconfirm your episode progress when you return in a new browser session.
              </small>
            </span>
          </label>
        </div>
      ) : null}
    </div>
  );
}
