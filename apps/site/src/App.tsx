import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router";
import { AppShell } from "./components/AppShell";
import { EventDetailPage } from "./routes/EventDetailPage";
import { MapPage } from "./routes/MapPage";
import { OverviewPage } from "./routes/OverviewPage";
import { PartyPlannerPage } from "./routes/PartyPlannerPage";
import { PokemonDetailPage } from "./routes/PokemonDetailPage";
import { PokemonIndexPage } from "./routes/PokemonIndexPage";
import { RulesPage } from "./routes/RulesPage";
import { SoulLinkDetailPage } from "./routes/SoulLinkDetailPage";
import { TimelinePage } from "./routes/TimelinePage";

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);

  return null;
}

export function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<OverviewPage />} />
          <Route path="timeline" element={<TimelinePage />} />
          <Route path="pokemon" element={<PokemonIndexPage />} />
          <Route path="pokemon/:pokemonId" element={<PokemonDetailPage />} />
          <Route path="party-planner" element={<PartyPlannerPage />} />
          <Route path="soul-links/:linkId" element={<SoulLinkDetailPage />} />
          <Route path="events/:eventId" element={<EventDetailPage />} />
          <Route path="map" element={<MapPage />} />
          <Route path="rules" element={<RulesPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </>
  );
}
