import { useRunView } from "../context/RunViewContext";

export function RulesPage() {
  const { dataset, visibleThroughEpisode } = useRunView();

  return (
    <div className="page-stack page-stack--tight">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Easy reference</p>
          <h1>Run Rules</h1>
        </div>
      </header>

      <section className="rules-quick">
        <h2>What you need to know</h2>
        <div className="rules-quick__grid">
          {dataset.rules.map((rule) => (
            <a className="rules-quick__link" href={`#${rule.id}`} key={rule.id}>
              <strong>{rule.title}</strong>
              <span>{rule.shortSummary}</span>
              <small>View full rule ↓</small>
            </a>
          ))}
        </div>
      </section>

      <div className="rules-list">
        {dataset.rules.map((rule) => {
          const version =
            [...rule.versions]
              .reverse()
              .find((entry) => entry.effectiveFromEpisode <= visibleThroughEpisode) ??
            rule.versions[0];
          return (
            <article className="rule-card" id={rule.id} key={rule.id}>
              <span className="rule-card__category">{rule.category}</span>
              <h2>{rule.title}</h2>
              <strong>{version?.summary}</strong>
              <p>{version?.description}</p>
              {version ? (
                <small>In effect from Episode {version.effectiveFromEpisode}</small>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
