# Published run content

Only public, publish-ready run data belongs here.

Drafts must stay under `.local/drafts/`, which is ignored by Git. This matters because the repository and GitHub Pages deployment are public: unpublished episode data must never be committed merely to hide it in the UI.

Step 2 establishes the shared Zod contracts in `packages/core` and the HGSS-specific progression/location contracts in `packages/hgss`.

Current public planning files:

- `run.json` — schema-versioned run metadata;
- `players.json` — player records once the participants are known;
- `rules.json` — the run's published rules;
- `tags.json` — reusable event tag definitions;
- `episodes/` — one published episode record per file;
- `events/` — chronological event records;
- `pokemon/` — persistent Pokémon identity records;
- `soul-links/` — persistent Soul Link identity records.

Current state is never stored here as a second source of truth. Species evolution, nicknames, party/box state, deaths, Soul Link state, badges and map progression will be reconstructed from the event history by the Step 3 state engine.
