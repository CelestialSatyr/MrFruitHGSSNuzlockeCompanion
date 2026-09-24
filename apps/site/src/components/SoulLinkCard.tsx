import type { Player, PokemonId, PokemonState, RunDataset, SoulLinkState } from "@nuzlocke/core";
import { Link } from "react-router";
import { PokemonPortrait } from "./PokemonPortrait";

interface SoulLinkCardProps {
  link: SoulLinkState;
  dataset: RunDataset;
  pokemonById: ReadonlyMap<PokemonId, PokemonState>;
  compact?: boolean;
}

function lifeLabel(pokemon: PokemonState): string {
  if (pokemon.lifeStatus === "dead") return "Fainted";
  if (pokemon.lifeStatus === "retired-by-link") return "Retired by link";
  if (pokemon.lifeStatus === "retired") return "Retired";
  if (pokemon.placement === "box") return "Boxed";
  if (pokemon.placement === "party") return "Party";
  return "Active";
}

export function SoulLinkCard({ link, dataset, pokemonById, compact = false }: SoulLinkCardProps) {
  const [leftId, rightId] = link.pokemonIds;
  const left = pokemonById.get(leftId);
  const right = pokemonById.get(rightId);
  if (!left || !right) return null;

  const playerById = new Map<string, Player>(dataset.players.map((player) => [player.id, player]));
  const leftPlayer = playerById.get(left.playerId);
  const rightPlayer = playerById.get(right.playerId);

  return (
    <article
      className={`soul-link-card soul-link-card--${link.status}${compact ? " soul-link-card--compact" : ""}`}
    >
      <div className="soul-link-card__member">
        <span className="member-owner">
          {leftPlayer?.shortName ?? leftPlayer?.displayName ?? "Player"}
        </span>
        <PokemonPortrait pokemon={left} compact={compact} />
        <span className="member-state">{lifeLabel(left)}</span>
      </div>

      <Link
        className="soul-link-bridge"
        to={`/soul-links/${link.id}`}
        aria-label={`Open ${link.id} history`}
      >
        <span className="soul-link-bridge__line" aria-hidden="true" />
        <strong>
          {link.status === "active"
            ? "Soul Link"
            : link.status === "lost"
              ? "Link Lost"
              : "Retired"}
        </strong>
        <span className="soul-link-bridge__line" aria-hidden="true" />
      </Link>

      <div className="soul-link-card__member">
        <span className="member-owner">
          {rightPlayer?.shortName ?? rightPlayer?.displayName ?? "Player"}
        </span>
        <PokemonPortrait pokemon={right} compact={compact} />
        <span className="member-state">{lifeLabel(right)}</span>
      </div>
    </article>
  );
}
