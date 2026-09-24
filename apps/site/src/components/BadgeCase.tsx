import type { CSSProperties } from "react";
import "../styles/badge-pixel.css";

const BADGE_ASSET_ROOT = `${import.meta.env.BASE_URL}badges/`;

const HGSS_BADGE_SPRITES = {
  zephyr: {
    url: `${BADGE_ASSET_ROOT}zephyr.png`,
    width: 22,
    height: 24,
  },
  hive: {
    url: `${BADGE_ASSET_ROOT}hive.png`,
    width: 22,
    height: 22,
  },
  plain: {
    url: `${BADGE_ASSET_ROOT}plain.png`,
    width: 24,
    height: 24,
  },
  fog: {
    url: `${BADGE_ASSET_ROOT}fog.png`,
    width: 22,
    height: 20,
  },
  storm: {
    url: `${BADGE_ASSET_ROOT}storm.png`,
    width: 23,
    height: 20,
  },
  mineral: {
    url: `${BADGE_ASSET_ROOT}mineral.png`,
    width: 22,
    height: 22,
  },
  glacier: {
    url: `${BADGE_ASSET_ROOT}glacier.png`,
    width: 20,
    height: 22,
  },
  rising: {
    url: `${BADGE_ASSET_ROOT}rising.png`,
    width: 20,
    height: 22,
  },
} as const;

export const JOHTO_BADGES = [
  {
    id: "zephyr",
    name: "Zephyr",
    className: "badge-token--zephyr",
    spriteUrl: HGSS_BADGE_SPRITES.zephyr.url,
    spriteWidth: 22,
    spriteHeight: 24,
  },
  {
    id: "hive",
    name: "Hive",
    className: "badge-token--hive",
    spriteUrl: HGSS_BADGE_SPRITES.hive.url,
    spriteWidth: 22,
    spriteHeight: 22,
  },
  {
    id: "plain",
    name: "Plain",
    className: "badge-token--plain",
    spriteUrl: HGSS_BADGE_SPRITES.plain.url,
    spriteWidth: 24,
    spriteHeight: 24,
  },
  {
    id: "fog",
    name: "Fog",
    className: "badge-token--fog",
    spriteUrl: HGSS_BADGE_SPRITES.fog.url,
    spriteWidth: 22,
    spriteHeight: 20,
  },
  {
    id: "storm",
    name: "Storm",
    className: "badge-token--storm",
    spriteUrl: HGSS_BADGE_SPRITES.storm.url,
    spriteWidth: 23,
    spriteHeight: 20,
  },
  {
    id: "mineral",
    name: "Mineral",
    className: "badge-token--mineral",
    spriteUrl: HGSS_BADGE_SPRITES.mineral.url,
    spriteWidth: 22,
    spriteHeight: 22,
  },
  {
    id: "glacier",
    name: "Glacier",
    className: "badge-token--glacier",
    spriteUrl: HGSS_BADGE_SPRITES.glacier.url,
    spriteWidth: 20,
    spriteHeight: 22,
  },
  {
    id: "rising",
    name: "Rising",
    className: "badge-token--rising",
    spriteUrl: HGSS_BADGE_SPRITES.rising.url,
    spriteWidth: 20,
    spriteHeight: 22,
  },
] as const;

export type JohtoBadgeId = (typeof JOHTO_BADGES)[number]["id"];

export function BadgeCase({ earnedBadgeIds }: { earnedBadgeIds: ReadonlySet<string> }) {
  return (
    <div className="badge-case" aria-label={`${earnedBadgeIds.size} of 8 Johto badges earned`}>
      {JOHTO_BADGES.map((badge) => {
        const earned = earnedBadgeIds.has(badge.id);

        return (
          <div
            key={badge.id}
            className={`badge-token ${badge.className}${earned ? " badge-token--earned" : ""}`}
            title={`${badge.name} Badge${earned ? " — earned" : " — not yet earned"}`}
          >
            <span className="badge-token__icon" aria-hidden="true">
              <GymBadgeIcon id={badge.id} />
            </span>
            <strong>{badge.name}</strong>
          </div>
        );
      })}
    </div>
  );
}

export function GymBadgeIcon({ id }: { id: JohtoBadgeId }) {
  const badge = JOHTO_BADGES.find((entry) => entry.id === id);
  if (!badge) return null;

  const width = badge.spriteWidth;
  const height = badge.spriteHeight;
  const style = {
    "--hgss-badge-case-width": `${width * 2}px`,
    "--hgss-badge-case-height": `${height * 2}px`,
    "--hgss-badge-gym-width": `${width * 5}px`,
    "--hgss-badge-gym-height": `${height * 5}px`,
    "--hgss-badge-gym-mobile-width": `${width * 4}px`,
    "--hgss-badge-gym-mobile-height": `${height * 4}px`,
  } as CSSProperties;

  return (
    <img
      className="hgss-badge-sprite"
      src={badge.spriteUrl}
      width={width}
      height={height}
      style={style}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
}
