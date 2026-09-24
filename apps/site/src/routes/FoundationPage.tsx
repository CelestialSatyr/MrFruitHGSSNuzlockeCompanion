import { CORE_VERSION, describeFoundation } from "@nuzlocke/core";
import { GAME_ID, GAME_LABEL } from "@nuzlocke/hgss";

const foundation = describeFoundation();

export function FoundationPage() {
  return (
    <div className="page-stack">
      <section className="hero-panel">
        <p className="eyebrow">Foundation · Step 1</p>
        <h1>The new companion is running on the shared architecture.</h1>
        <p className="hero-copy">
          This is the initial public shell. The site and local editor already consume the same Core
          and HGSS packages, so the data model can become the single source of truth in Step 2.
        </p>
        <div className="status-row" aria-label="Foundation status">
          <span>Core {CORE_VERSION}</span>
          <span>{GAME_LABEL}</span>
          <span>{GAME_ID}</span>
        </div>
      </section>

      <section>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Architecture</p>
            <h2>One engine, two applications</h2>
          </div>
        </div>

        <div className="architecture-grid">
          {foundation.layers.map((layer) => (
            <article className="architecture-card" key={layer.id}>
              <span className="architecture-card__badge">{layer.scope}</span>
              <h3>{layer.name}</h3>
              <p>{layer.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="next-panel">
        <div>
          <p className="eyebrow">Next</p>
          <h2>Step 2 · Complete data contract</h2>
          <p>
            Run, players, episodes, Pokémon, Soul Links, rules, locations, encounter opportunities
            and discriminated event schemas—including YouTube timestamps.
          </p>
        </div>
        <div className="next-panel__number" aria-hidden="true">
          02
        </div>
      </section>
    </div>
  );
}
