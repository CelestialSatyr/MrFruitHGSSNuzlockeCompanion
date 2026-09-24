import { NavLink, Outlet } from "react-router";
import { SettingsMenu } from "./SettingsMenu";
import { RunSelector } from "./RunSelector";
import { SiteFooter } from "./SiteFooter";
import { SpoilerWelcomeDialog } from "./SpoilerWelcomeDialog";
import { useRunView } from "../context/RunViewContext";

const navigation = [
  { to: "/", label: "Overview", shortLabel: "Home" },
  { to: "/timeline", label: "Timeline", shortLabel: "Timeline" },
  { to: "/pokemon", label: "Soul Link Roster", shortLabel: "Roster" },
  { to: "/map", label: "Map", shortLabel: "Map" },
  { to: "/rules", label: "Rules", shortLabel: "Rules" },
] as const;

function navClassName({ isActive }: { isActive: boolean }) {
  return isActive ? "nav-link nav-link--active" : "nav-link";
}

export function AppShell() {
  const { dataset, isDraftPreview, spoilerPromptOpen } = useRunView();

  const playerOneId = dataset.run.playerIds[0];
  const playerOne = dataset.players.find((player) => player.id === playerOneId);
  const playerOneInitial = playerOne?.displayName.trim().charAt(0).toUpperCase() || "◎";

  return (
    <div className="app-shell">
      <div
        className={spoilerPromptOpen ? "site-underlay site-underlay--blurred" : "site-underlay"}
        aria-hidden={spoilerPromptOpen}
        inert={spoilerPromptOpen}
      >
        {isDraftPreview ? (
          <div className="draft-preview-banner">LOCAL DRAFT PREVIEW · Not public</div>
        ) : null}
        <header className="site-header">
          <div className="site-header__inner">
            <NavLink to="/" className="brand" aria-label="Nuzlocke Companion overview">
              <span className="brand__mark" aria-hidden="true">
                {playerOne?.avatarUrl ? <img src={playerOne.avatarUrl} alt="" /> : playerOneInitial}
              </span>
              <span>
                <strong>Nuzlocke Companion</strong>
                <small>Soul Link · HGSS</small>
              </span>
            </NavLink>

            <nav className="desktop-nav" aria-label="Primary navigation">
              {navigation.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.to === "/"} className={navClassName}>
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <RunSelector />
            <SettingsMenu />
          </div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>
        <SiteFooter />

        <nav className="mobile-nav" aria-label="Mobile navigation">
          {navigation.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === "/"} className={navClassName}>
              {item.shortLabel}
            </NavLink>
          ))}
        </nav>
      </div>

      <SpoilerWelcomeDialog />
    </div>
  );
}
