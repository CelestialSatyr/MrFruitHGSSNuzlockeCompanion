import { getEventReferences, type PokemonState, type RunEvent } from "@nuzlocke/core";
import { HGSS_MAIN_STORY_LOCATIONS } from "@nuzlocke/hgss";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useRunView } from "../context/RunViewContext";
import { usePokemonTypeMap } from "../hooks/usePokemonTypes";
import { getEventLocationName, getPokemonCatchLocationName } from "../lib/encounter-locations";
import { titleCase } from "../lib/format";
import { getSpeciesName } from "../lib/pokemon";
import { normalizeSearchText, searchMatchScore } from "../lib/search";

interface GlobalSearchResult {
  id: string;
  kind: "page" | "pokemon" | "soul-link" | "location" | "event";
  label: string;
  detail: string;
  to: string;
  searchText: string;
  priority: number;
}

const PAGE_RESULTS: readonly GlobalSearchResult[] = [
  {
    id: "page-overview",
    kind: "page",
    label: "Overview",
    detail: "Current teams, run status and badges",
    to: "/",
    searchText: "overview home current teams run status badges",
    priority: 2,
  },
  {
    id: "page-timeline",
    kind: "page",
    label: "Timeline",
    detail: "Episodes, encounters, battles and run history",
    to: "/timeline",
    searchText: "timeline episodes encounters battles run history events",
    priority: 2,
  },
  {
    id: "page-roster",
    kind: "page",
    label: "Soul Link Roster",
    detail: "All visible Pokémon and linked pairs",
    to: "/pokemon",
    searchText: "pokemon soul link roster catches pairs species typings types",
    priority: 2,
  },
  {
    id: "page-planner",
    kind: "page",
    label: "Party Planner",
    detail: "Automatic and manual linked-party planning",
    to: "/party-planner",
    searchText: "party planner automatic manual team base stats bst primary typing",
    priority: 2,
  },
  {
    id: "page-map",
    kind: "page",
    label: "Run Map",
    detail: "Interactive Johto encounter map",
    to: "/map",
    searchText: "map routes locations johto encounters fishing surf",
    priority: 2,
  },
  {
    id: "page-rules",
    kind: "page",
    label: "Rules",
    detail: "Soul Link and Nuzlocke rules",
    to: "/rules",
    searchText: "rules rulings nuzlocke soul link clauses",
    priority: 2,
  },
];

const KIND_LABELS: Record<GlobalSearchResult["kind"], string> = {
  page: "Page",
  pokemon: "Pokémon",
  "soul-link": "Soul Link",
  location: "Location",
  event: "Timeline event",
};

function pokemonLabel(pokemon: PokemonState): string {
  return pokemon.currentNickname ?? getSpeciesName(pokemon.currentSpeciesId);
}

function eventLabel(event: RunEvent): string {
  if (event.title?.trim()) return event.title;
  if (event.type === "encounter") {
    const caught = event.outcomes.filter((outcome) => outcome.result === "caught");
    if (caught.length)
      return caught.map((outcome) => getSpeciesName(outcome.speciesId)).join(" + ");
    return `Encounter · ${getEventLocationName(event) ?? titleCase(event.locationId)}`;
  }
  if (event.type === "gym-battle") return `${event.leaderName} battle`;
  if (event.type === "major-battle") return event.battleName;
  if (event.type === "evolution") {
    return `${getSpeciesName(event.fromSpeciesId)} → ${getSpeciesName(event.toSpeciesId)}`;
  }
  return titleCase(event.type);
}

function buildEventSearchText(
  event: RunEvent,
  dataset: ReturnType<typeof useRunView>["dataset"],
  state: ReturnType<typeof useRunView>["state"],
): string {
  const values = [
    event.type,
    event.title ?? "",
    event.description ?? "",
    getEventLocationName(event) ?? "",
    JSON.stringify(event),
  ];

  for (const pokemonId of getEventReferences(event).pokemonIds) {
    const pokemon = state.pokemon.get(pokemonId);
    if (!pokemon) continue;
    values.push(
      pokemon.currentNickname ?? "",
      getSpeciesName(pokemon.currentSpeciesId),
      getSpeciesName(pokemon.source.initialSpeciesId),
    );
  }

  if (event.type === "encounter") {
    for (const outcome of event.outcomes) {
      if (outcome.speciesId) values.push(getSpeciesName(outcome.speciesId));
      if (outcome.result === "caught" && outcome.nickname) values.push(outcome.nickname);
    }
  }

  return values.join(" ");
}

export function GlobalSearch() {
  const { dataset, state } = useRunView();
  const location = useLocation();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const speciesIds = useMemo(
    () => [...new Set([...state.pokemon.values()].map((pokemon) => pokemon.currentSpeciesId))],
    [state],
  );
  const { typesBySpecies, loading: typesLoading } = usePokemonTypeMap(open ? speciesIds : []);

  useEffect(() => {
    setOpen(false);
    setQuery("");
  }, [location.pathname, location.search]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target;
      const isTypingTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable);

      if (event.key === "Escape" && open) {
        event.preventDefault();
        setOpen(false);
        return;
      }

      const shortcut =
        (event.key === "/" && !isTypingTarget) ||
        ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k");
      if (!shortcut) return;

      event.preventDefault();
      setOpen(true);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const searchIndex = useMemo<GlobalSearchResult[]>(() => {
    const results: GlobalSearchResult[] = [...PAGE_RESULTS];
    const playersById = new Map(dataset.players.map((player) => [player.id, player]));

    for (const pokemon of state.pokemon.values()) {
      const species = getSpeciesName(pokemon.currentSpeciesId);
      const owner = playersById.get(pokemon.playerId);
      const types = typesBySpecies.get(pokemon.currentSpeciesId) ?? [];
      const catchLocation = getPokemonCatchLocationName(dataset, pokemon) ?? "";
      const label = pokemonLabel(pokemon);
      const detailParts = [
        pokemon.currentNickname ? species : undefined,
        owner?.displayName,
        types.length ? types.map(titleCase).join(" / ") : undefined,
        catchLocation ? `Caught · ${catchLocation}` : undefined,
      ].filter((value): value is string => Boolean(value));

      results.push({
        id: `pokemon-${pokemon.id}`,
        kind: "pokemon",
        label,
        detail: detailParts.join(" · "),
        to: `/pokemon/${pokemon.id}`,
        searchText: [
          label,
          species,
          getSpeciesName(pokemon.source.initialSpeciesId),
          owner?.displayName ?? "",
          owner?.shortName ?? "",
          catchLocation,
          ...types,
        ].join(" "),
        priority: 6,
      });
    }

    for (const link of state.soulLinks.values()) {
      const pokemon = link.pokemonIds
        .map((pokemonId) => state.pokemon.get(pokemonId))
        .filter((entry): entry is PokemonState => entry !== undefined);
      const labels = pokemon.map(pokemonLabel);
      if (!labels.length) continue;
      results.push({
        id: `soul-link-${link.id}`,
        kind: "soul-link",
        label: labels.join(" + "),
        detail: `${titleCase(link.status)} Soul Link`,
        to: `/soul-links/${link.id}`,
        searchText: pokemon
          .flatMap((entry) => [
            pokemonLabel(entry),
            getSpeciesName(entry.currentSpeciesId),
            getSpeciesName(entry.source.initialSpeciesId),
          ])
          .concat(link.status, "soul link", "pair")
          .join(" "),
        priority: 5,
      });
    }

    for (const mapLocation of HGSS_MAIN_STORY_LOCATIONS) {
      results.push({
        id: `location-${mapLocation.id}`,
        kind: "location",
        label: mapLocation.name,
        detail: `${titleCase(mapLocation.kind)} · ${titleCase(mapLocation.region)}`,
        to: `/map?location=${encodeURIComponent(mapLocation.id)}&planner=open`,
        searchText: `${mapLocation.name} ${mapLocation.id} ${mapLocation.kind} ${mapLocation.region} route location map encounter`,
        priority: 4,
      });
    }

    const processedEventIds = new Set(state.processedEventIds);
    for (const event of dataset.events) {
      if (!processedEventIds.has(event.id)) continue;
      if (event.type === "level-milestone" || event.visibility?.runTimeline === false) continue;
      const eventLocation = getEventLocationName(event);
      results.push({
        id: `event-${event.id}`,
        kind: "event",
        label: eventLabel(event),
        detail: eventLocation ? `Timeline · ${eventLocation}` : "Timeline event",
        to: `/events/${event.id}`,
        searchText: buildEventSearchText(event, dataset, state),
        priority: 3,
      });
    }

    return results;
  }, [dataset, state, typesBySpecies]);

  const results = useMemo(() => {
    if (!normalizeSearchText(query)) return [];
    return searchIndex
      .map((result) => ({
        result,
        score: searchMatchScore(result.label, `${result.label} ${result.searchText}`, query),
      }))
      .filter((entry) => entry.score >= 0)
      .sort(
        (left, right) =>
          right.score - left.score ||
          right.result.priority - left.result.priority ||
          left.result.label.localeCompare(right.result.label),
      )
      .slice(0, 12)
      .map((entry) => entry.result);
  }, [query, searchIndex]);

  function chooseFirstResult() {
    const first = results[0];
    if (!first) return;
    setOpen(false);
    setQuery("");
    navigate(first.to);
  }

  return (
    <div className="global-search">
      <button
        type="button"
        className="global-search__trigger"
        aria-label="Search the companion"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span className="global-search__trigger-icon" aria-hidden="true">
          ⌕
        </span>
        <span className="global-search__trigger-label">Search</span>
        <kbd>/</kbd>
      </button>

      {open ? (
        <div
          className="global-search__backdrop"
          role="presentation"
          onMouseDown={() => setOpen(false)}
        >
          <section
            className="global-search__dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Search the Nuzlocke companion"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="global-search__input-wrap">
              <span aria-hidden="true">⌕</span>
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    chooseFirstResult();
                  }
                }}
                placeholder="Search Pokémon, nickname, route, event…"
                autoComplete="off"
              />
              <button type="button" onClick={() => setOpen(false)} aria-label="Close search">
                Esc
              </button>
            </div>

            <div className="global-search__body" aria-live="polite">
              {!normalizeSearchText(query) ? (
                <div className="global-search__empty-state">
                  <strong>Search the whole companion</strong>
                  <span>
                    Try a nickname, Pokémon species, type, Soul Link, route, location, event, or
                    page.
                  </span>
                  <small>Press / or Ctrl+K anywhere on the site to open this search.</small>
                </div>
              ) : results.length ? (
                <div className="global-search__results">
                  {results.map((result) => (
                    <Link
                      key={result.id}
                      className="global-search-result"
                      to={result.to}
                      onClick={() => {
                        setOpen(false);
                        setQuery("");
                      }}
                    >
                      <span
                        className={`global-search-result__kind global-search-result__kind--${result.kind}`}
                      >
                        {KIND_LABELS[result.kind]}
                      </span>
                      <span className="global-search-result__copy">
                        <strong>{result.label}</strong>
                        <small>{result.detail}</small>
                      </span>
                      <span className="global-search-result__arrow" aria-hidden="true">
                        →
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="global-search__empty-state">
                  <strong>No results for “{query.trim()}”</strong>
                  <span>Try a nickname, species, route, location, event, or page name.</span>
                  {typesLoading ? <small>Pokémon typing data is still loading…</small> : null}
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
