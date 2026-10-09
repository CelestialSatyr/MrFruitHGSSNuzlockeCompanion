import {
  getEventReferences,
  type EventTagDefinition,
  type PlayerId,
  type PokemonId,
  type PokemonState,
  type RunDataset,
  type RunEvent,
  type RunState,
} from "@nuzlocke/core";
import type { HgssProgressionState } from "@nuzlocke/hgss";
import { Link } from "react-router";
import { GymBadgeIcon, JOHTO_BADGES, type JohtoBadgeId } from "./BadgeCase";
import { PokemonPrimaryRuleBadges } from "./PokemonPrimaryRuleBadges";
import { formatTimestamp, titleCase } from "../lib/format";
import { getHgssSpriteUrl, getSpeciesName } from "../lib/pokemon";
import { getPlayerForTheme, getPlayerTheme, type PlayerTheme } from "../lib/player-theme";

interface EventCardProps {
  event: RunEvent;
  dataset: RunDataset;
  state: RunState<HgssProgressionState>;
  compact?: boolean;
}

type PlayerAccent = "gold" | "silver" | "dual" | "neutral";

function buildYouTubeTimestampUrl(videoUrl: string, seconds: number): string {
  const timestamp = Math.max(0, Math.floor(seconds));

  try {
    const url = new URL(videoUrl);
    url.searchParams.set("t", `${timestamp}s`);
    return url.toString();
  } catch {
    const separator = videoUrl.includes("?") ? "&" : "?";
    return `${videoUrl}${separator}t=${timestamp}s`;
  }
}

function EventTimestamp({
  episode,
  seconds,
}: {
  episode: RunDataset["episodes"][number] | undefined;
  seconds: number;
}) {
  const label = formatTimestamp(seconds);

  if (!episode?.youtube?.url) {
    return <span className="timestamp">▶ {label}</span>;
  }

  return (
    <a
      className="timestamp timestamp--link"
      href={buildYouTubeTimestampUrl(episode.youtube.url, seconds)}
      target="_blank"
      rel="noreferrer"
      title={`Watch Episode ${episode.number} from ${label} on YouTube`}
      aria-label={`Watch Episode ${episode.number} from ${label} on YouTube`}
    >
      ▶ {label}
    </a>
  );
}

function eventTitle(event: RunEvent): string {
  if (event.title) return event.title;
  switch (event.type) {
    case "encounter":
      return event.acquisitionType === "starter" ? "Soul Link formed" : "New Encounter";
    case "evolution":
      return `${getSpeciesName(event.fromSpeciesId)} evolved`;
    case "gym-battle":
      return event.result === "win"
        ? `${event.leaderName} defeated`
        : `Battle with ${event.leaderName}`;
    case "pokemon-death":
      return "A Soul Link is lost";
    case "special-moment":
      return event.title;
    case "nickname-changed":
      return "Nickname changed";
    case "party-changed":
      return "Party changed";
    case "level-milestone":
      return `Level ${event.level}`;
    case "major-battle":
      return event.battleName;
    case "progression-changed":
      return "Progress updated";
    case "rule-ruling":
      return "Rules ruling";
    case "custom":
      return event.title;
    case "move-changed":
      return "Move set changed";
    case "held-item-changed":
      return "Held item changed";
    case "ability-changed":
      return "Ability changed";
    case "form-changed":
      return "Form changed";
    case "pokemon-revived":
      return "Pokémon revived";
  }
}

function eventSummary(event: RunEvent, dataset: RunDataset): string {
  if (event.description) return event.description;
  switch (event.type) {
    case "encounter": {
      const caught = event.outcomes.filter((outcome) => outcome.result === "caught");
      if (caught.length === 2) {
        return `${caught.map((outcome) => getSpeciesName(outcome.speciesId)).join(" and ")} became linked at ${titleCase(event.locationId)}.`;
      }
      return `The encounter at ${titleCase(event.locationId)} did not produce a Soul Link.`;
    }
    case "evolution":
      return `${getSpeciesName(event.fromSpeciesId)} evolved into ${getSpeciesName(event.toSpeciesId)}${event.level ? ` at level ${event.level}` : ""}.`;
    case "gym-battle":
      return event.result === "win"
        ? `The team defeated ${event.leaderName}${event.badgeId ? ` and earned the ${titleCase(event.badgeId)} Badge` : ""}.`
        : `The team lost against ${event.leaderName}.`;
    case "pokemon-death": {
      const pokemon = dataset.pokemon.find((entry) => entry.id === event.pokemonId);
      return `${pokemon ? getSpeciesName(pokemon.initialSpeciesId) : "A Pokémon"} fainted. ${event.cause}`;
    }
    case "special-moment":
      return event.description;
    case "nickname-changed":
      return `Renamed to ${event.toNickname}.`;
    case "party-changed":
      return `Moved ${event.pokemonIds.length} Pokémon to ${event.to}.`;
    case "level-milestone":
      return event.label ?? `Reached level ${event.level}.`;
    case "major-battle":
      return `${event.battleName}: ${event.result}.`;
    case "progression-changed":
      return `${titleCase(event.flag.id)} set to ${String(event.flag.value)}.`;
    case "rule-ruling":
      return event.details;
    case "custom":
      return event.description;
    case "move-changed":
      return "A move was learned, forgotten, or replaced.";
    case "held-item-changed":
      return "The held item changed.";
    case "ability-changed":
      return `Ability changed to ${event.toAbilityId}.`;
    case "form-changed":
      return `Form changed to ${event.toFormId}.`;
    case "pokemon-revived":
      return event.reason;
  }
}

function eventPlayerIds(event: RunEvent, state: RunState<HgssProgressionState>): PlayerId[] {
  if (event.type === "encounter") return event.outcomes.map((outcome) => outcome.playerId);
  const references = getEventReferences(event);
  return [
    ...new Set(
      references.pokemonIds
        .map((id) => state.pokemon.get(id)?.playerId)
        .filter((id): id is PlayerId => id !== undefined),
    ),
  ];
}

function getPlayerAccent(
  event: RunEvent,
  dataset: RunDataset,
  state: RunState<HgssProgressionState>,
): PlayerAccent {
  const playerIds = [...new Set(eventPlayerIds(event, state))];
  if (playerIds.length > 1) return "dual";

  const playerId = playerIds[0];
  if (!playerId) return "neutral";

  const player = dataset.players.find((entry) => entry.id === playerId);
  return player ? getPlayerTheme(player) : "neutral";
}

function playerAccentLabel(accent: PlayerAccent, dataset: RunDataset): string | undefined {
  if (accent === "dual") return "Both players";
  if (accent === "neutral") return undefined;
  return getPlayerForTheme(dataset, accent)?.displayName;
}

function PokemonSprite({ pokemon }: { pokemon: PokemonState }) {
  return <img src={getHgssSpriteUrl(pokemon.currentSpeciesId, pokemon.source.shiny)} alt="" />;
}

function LinkedPokemonSprite({
  pokemon,
  className = "",
}: {
  pokemon: PokemonState;
  className?: string;
}) {
  const species = getSpeciesName(pokemon.currentSpeciesId);
  return (
    <Link
      className={className}
      to={`/pokemon/${pokemon.id}`}
      title={pokemon.currentNickname ?? species}
      aria-label={`Open ${pokemon.currentNickname ?? species}'s profile`}
    >
      <PokemonSprite pokemon={pokemon} />
    </Link>
  );
}

function SpeciesSpriteLink({
  pokemonId,
  speciesId,
  shiny,
}: {
  pokemonId: PokemonId | undefined;
  speciesId: number;
  shiny: boolean;
}) {
  const image = <img src={getHgssSpriteUrl(speciesId, shiny)} alt="" />;
  if (!pokemonId) return image;
  const species = getSpeciesName(speciesId);
  return (
    <Link to={`/pokemon/${pokemonId}`} title={species} aria-label={`Open ${species}'s profile`}>
      {image}
    </Link>
  );
}

function EventVisual({ event, state }: { event: RunEvent; state: RunState<HgssProgressionState> }) {
  if (event.type === "evolution") {
    const pokemon = state.pokemon.get(event.pokemonId);
    const shiny = pokemon?.source.shiny ?? false;
    return (
      <div className="event-visual event-visual--evolution">
        <SpeciesSpriteLink
          pokemonId={event.pokemonId}
          speciesId={event.fromSpeciesId}
          shiny={shiny}
        />
        <span aria-hidden="true">→</span>
        <SpeciesSpriteLink
          pokemonId={event.pokemonId}
          speciesId={event.toSpeciesId}
          shiny={shiny}
        />
      </div>
    );
  }

  if (event.type === "pokemon-death") {
    const pokemon = state.pokemon.get(event.pokemonId);
    return pokemon ? (
      <div className="event-visual event-visual--loss">
        <LinkedPokemonSprite pokemon={pokemon} />
        <span aria-hidden="true">×</span>
      </div>
    ) : (
      <div className="event-visual event-visual--loss" aria-hidden="true">
        ×
      </div>
    );
  }

  if (event.type === "special-moment") {
    return (
      <div className="event-visual event-visual--moment" aria-hidden="true">
        ★
      </div>
    );
  }

  const references = getEventReferences(event);
  const pokemon = references.pokemonIds
    .map((id) => state.pokemon.get(id))
    .find((entry): entry is PokemonState => entry !== undefined);
  if (pokemon) {
    return (
      <div className="event-visual event-visual--pokemon">
        <LinkedPokemonSprite pokemon={pokemon} />
      </div>
    );
  }

  return (
    <div className="event-visual event-visual--generic" aria-hidden="true">
      ◇
    </div>
  );
}

function DualSideVisual({
  playerId,
  side,
  event,
  dataset,
  state,
}: {
  playerId: PlayerId | undefined;
  side: "left" | "right";
  event: RunEvent;
  dataset: RunDataset;
  state: RunState<HgssProgressionState>;
}) {
  const player = dataset.players.find((entry) => entry.id === playerId);
  const theme: PlayerTheme = player ? getPlayerTheme(player) : side === "left" ? "silver" : "gold";

  if (event.type === "encounter") {
    const outcome = event.outcomes.find((entry) => entry.playerId === playerId);
    if (!outcome) {
      return (
        <div
          className={`event-side-visual event-side-visual--${side} event-side-visual--${theme}`}
        />
      );
    }
    const authored =
      outcome.result === "caught"
        ? dataset.pokemon.find((entry) => entry.id === outcome.pokemonId)
        : undefined;
    const caughtPokemon =
      outcome.result === "caught" ? state.pokemon.get(outcome.pokemonId) : undefined;

    const outcomeLabel =
      outcome.result === "failed"
        ? "× Failed"
        : outcome.result === "skipped"
          ? "— Skipped"
          : "Caught";

    return (
      <div
        className={`event-side-visual event-side-visual--${side} event-side-visual--${theme} event-side-visual--outcome-${outcome.result}`}
      >
        <span className="event-side-visual__owner">
          {player?.shortName ?? player?.displayName ?? (side === "left" ? "Player 1" : "Player 2")}
        </span>
        <div className="event-side-visual__sprites">
          {outcome.speciesId ? (
            <SpeciesSpriteLink
              pokemonId={outcome.result === "caught" ? outcome.pokemonId : undefined}
              speciesId={outcome.speciesId}
              shiny={authored?.shiny ?? false}
            />
          ) : (
            <b aria-hidden="true">?</b>
          )}
        </div>
        <small className={`event-side-visual__result event-side-visual__result--${outcome.result}`}>
          {outcomeLabel}
        </small>
        {caughtPokemon ? (
          <PokemonPrimaryRuleBadges dataset={dataset} pokemon={caughtPokemon} />
        ) : null}
      </div>
    );
  }

  const references = getEventReferences(event);
  const pokemon = references.pokemonIds
    .map((id) => state.pokemon.get(id))
    .filter((entry): entry is PokemonState => entry?.playerId === playerId)
    .slice(0, 3);

  return (
    <div className={`event-side-visual event-side-visual--${side} event-side-visual--${theme}`}>
      <span className="event-side-visual__owner">
        {player?.shortName ?? player?.displayName ?? (side === "left" ? "Player 1" : "Player 2")}
      </span>
      <div className="event-side-visual__sprites">
        {pokemon.length ? (
          pokemon.map((entry) => <LinkedPokemonSprite key={entry.id} pokemon={entry} />)
        ) : (
          <span aria-hidden="true">◇</span>
        )}
      </div>
    </div>
  );
}

function GymBattleCard({
  event,
  dataset,
  state,
  compact,
}: {
  event: Extract<RunEvent, { type: "gym-battle" }>;
  dataset: RunDataset;
  state: RunState<HgssProgressionState>;
  compact: boolean;
}) {
  const episode = dataset.episodes.find((entry) => entry.id === event.episodeId);
  const participants = event.participantPokemonIds
    .map((id) => state.pokemon.get(id))
    .filter((pokemon): pokemon is PokemonState => pokemon !== undefined);
  const [leftPlayerId, rightPlayerId] = dataset.run.playerIds;
  const leftPlayer = dataset.players.find((player) => player.id === leftPlayerId);
  const rightPlayer = dataset.players.find((player) => player.id === rightPlayerId);
  const leftTheme: PlayerTheme = leftPlayer ? getPlayerTheme(leftPlayer) : "silver";
  const rightTheme: PlayerTheme = rightPlayer ? getPlayerTheme(rightPlayer) : "gold";
  const left = participants.filter((pokemon) => pokemon.playerId === leftPlayerId);
  const right = participants.filter((pokemon) => pokemon.playerId === rightPlayerId);
  const badge =
    event.badgeId && JOHTO_BADGES.some((entry) => entry.id === event.badgeId)
      ? (event.badgeId as JohtoBadgeId)
      : undefined;

  return (
    <article
      className={`event-card event-card--gym event-card--dual event-card--left-${leftTheme} event-card--right-${rightTheme}${compact ? " event-card--compact" : ""}`}
    >
      <div
        className={`gym-event__badge${badge ? ` gym-event__badge--${badge}` : ""}`}
        aria-hidden="true"
      >
        {badge ? <GymBadgeIcon id={badge} /> : <span>◆</span>}
      </div>
      <div className="gym-event__content">
        <div className="event-card__meta">
          <span>Episode {episode?.number ?? "?"}</span>
          {event.videoTimestampSeconds !== undefined ? (
            <EventTimestamp episode={episode} seconds={event.videoTimestampSeconds} />
          ) : null}
          <span>Gym Battle</span>
        </div>
        <p className="gym-event__eyebrow">
          Major battle · {event.result === "win" ? "Badge earned" : "Challenge"}
        </p>
        <h3>
          <Link to={`/events/${event.id}`}>{eventTitle(event)}</Link>
        </h3>
        <p>{eventSummary(event, dataset)}</p>
        <div className="gym-event__teams">
          <GymTeam label={leftPlayer?.displayName ?? "Player 1"} theme={leftTheme} pokemon={left} />
          <GymTeam
            label={rightPlayer?.displayName ?? "Player 2"}
            theme={rightTheme}
            pokemon={right}
          />
        </div>
      </div>
    </article>
  );
}

function GymTeam({
  label,
  theme,
  pokemon,
}: {
  label: string;
  theme: PlayerTheme;
  pokemon: PokemonState[];
}) {
  return (
    <div className={`gym-event-team gym-event-team--${theme}`}>
      <strong>{label}</strong>
      <div>
        {pokemon.map((entry) => (
          <LinkedPokemonSprite key={entry.id} pokemon={entry} />
        ))}
      </div>
    </div>
  );
}

function EventBody({
  event,
  dataset,
  state,
  accent,
}: {
  event: RunEvent;
  dataset: RunDataset;
  state: RunState<HgssProgressionState>;
  accent: PlayerAccent;
}) {
  const episode = dataset.episodes.find((entry) => entry.id === event.episodeId);
  const tagById = new Map<string, EventTagDefinition>(dataset.tags.map((tag) => [tag.id, tag]));
  const references = getEventReferences(event);
  const relatedPokemon = references.pokemonIds
    .map((id) => state.pokemon.get(id))
    .filter((value): value is PokemonState => value !== undefined);
  const shinyEncounter =
    event.type === "encounter" &&
    event.outcomes.some((outcome) => {
      if (outcome.result !== "caught") return false;
      return dataset.pokemon.find((entry) => entry.id === outcome.pokemonId)?.shiny === true;
    });
  const playerLabel = playerAccentLabel(accent, dataset);
  const hasTags = shinyEncounter || Boolean(event.tags?.length);

  return (
    <div className={`event-card__body${accent === "dual" ? " event-card__body--center" : ""}`}>
      <div className="event-card__meta">
        <span>Episode {episode?.number ?? "?"}</span>
        {event.videoTimestampSeconds !== undefined ? (
          <EventTimestamp episode={episode} seconds={event.videoTimestampSeconds} />
        ) : null}
        <span>{titleCase(event.type)}</span>
        {playerLabel ? (
          <span className={`event-owner event-owner--${accent}`}>{playerLabel}</span>
        ) : null}
      </div>

      {hasTags ? (
        <div className="tag-row">
          {shinyEncounter ? (
            <span className="event-tag event-tag--celebration">✨ Shiny encounter</span>
          ) : null}
          {event.tags?.map((assignment) => {
            const tag = tagById.get(assignment.tagId);
            return tag ? (
              <span
                key={`${event.id}-${tag.id}`}
                className={`event-tag event-tag--${tag.style}`}
                title={assignment.detail}
              >
                {tag.label}
              </span>
            ) : null;
          })}
        </div>
      ) : null}

      <h3>
        <Link to={`/events/${event.id}`}>{eventTitle(event)}</Link>
      </h3>
      <p>{eventSummary(event, dataset)}</p>

      {relatedPokemon.length > 0 && event.type !== "encounter" ? (
        <div className="event-card__references">
          {relatedPokemon.slice(0, 6).map((pokemon) => (
            <Link key={pokemon.id} to={`/pokemon/${pokemon.id}`}>
              {pokemon.currentNickname ?? getSpeciesName(pokemon.currentSpeciesId)}
              {pokemon.source.shiny ? " ✨" : ""}
            </Link>
          ))}
        </div>
      ) : null}

      {event.annotations?.map((annotation, index) => (
        <aside className="event-annotation" key={`${event.id}-annotation-${index}`}>
          <strong>{titleCase(annotation.kind)}</strong>
          <span>{annotation.text}</span>
        </aside>
      ))}
    </div>
  );
}

export function EventCard({ event, dataset, state, compact = false }: EventCardProps) {
  if (event.type === "gym-battle") {
    return <GymBattleCard event={event} dataset={dataset} state={state} compact={compact} />;
  }

  const accent = getPlayerAccent(event, dataset, state);
  const participatingPlayerIds = [...new Set(eventPlayerIds(event, state))];
  const [leftPlayerId, rightPlayerId] = dataset.run.playerIds;
  const leftPlayer = dataset.players.find((player) => player.id === leftPlayerId);
  const rightPlayer = dataset.players.find((player) => player.id === rightPlayerId);
  const leftTheme: PlayerTheme = leftPlayer ? getPlayerTheme(leftPlayer) : "silver";
  const rightTheme: PlayerTheme = rightPlayer ? getPlayerTheme(rightPlayer) : "gold";
  const singlePlayerSide =
    participatingPlayerIds.length === 1
      ? participatingPlayerIds[0] === leftPlayerId
        ? "left"
        : participatingPlayerIds[0] === rightPlayerId
          ? "right"
          : undefined
      : undefined;
  const unsuccessfulEncounter =
    event.type === "encounter" && event.outcomes.some((outcome) => outcome.result !== "caught");
  const className = `event-card event-card--${event.tone} event-card--${accent} event-card--left-${leftTheme} event-card--right-${rightTheme}${singlePlayerSide ? ` event-card--player-${singlePlayerSide}` : ""}${accent === "dual" ? " event-card--paired-layout" : ""}${unsuccessfulEncounter ? " event-card--encounter-unsuccessful" : ""}${event.importance === "major" ? " event-card--major" : ""}${compact ? " event-card--compact" : ""}`;

  if (accent === "dual") {
    return (
      <article className={className}>
        <DualSideVisual
          playerId={leftPlayerId}
          side="left"
          event={event}
          dataset={dataset}
          state={state}
        />
        <EventBody event={event} dataset={dataset} state={state} accent={accent} />
        <DualSideVisual
          playerId={rightPlayerId}
          side="right"
          event={event}
          dataset={dataset}
          state={state}
        />
      </article>
    );
  }

  return (
    <article className={className}>
      <EventVisual event={event} state={state} />
      <EventBody event={event} dataset={dataset} state={state} accent={accent} />
    </article>
  );
}
