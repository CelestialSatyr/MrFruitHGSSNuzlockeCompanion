import { useRunView } from "../context/RunViewContext";

export function RunSelector() {
  const { visibleRuns, selectedRunId, setSelectedRunId } = useRunView();
  if (!visibleRuns.length) return null;

  if (visibleRuns.length === 1) {
    const run = visibleRuns[0]!;
    return (
      <span className="run-selector run-selector--single">
        Run {run.dataset.run.attemptNumber ?? 1}
      </span>
    );
  }

  return (
    <label className="run-selector">
      <span>Run</span>
      <select
        aria-label="Select run"
        value={selectedRunId}
        onChange={(event) => setSelectedRunId(event.target.value)}
      >
        {visibleRuns.map(({ dataset, firstVisibleEpisodeNumber, lastVisibleEpisodeNumber }) => (
          <option key={dataset.run.id} value={dataset.run.id}>
            {dataset.run.attemptNumber ? `Run ${dataset.run.attemptNumber}` : dataset.run.title} ·
            Ep. {firstVisibleEpisodeNumber}
            {lastVisibleEpisodeNumber !== firstVisibleEpisodeNumber
              ? `–${lastVisibleEpisodeNumber}`
              : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
