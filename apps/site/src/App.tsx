import { Navigate, Route, Routes } from "react-router";
import { AppShell } from "./components/AppShell";
import { EventDetailPage } from "./routes/EventDetailPage";
import { MapPage } from "./routes/MapPage";
import { OverviewPage } from "./routes/OverviewPage";
import { PokemonDetailPage } from "./routes/PokemonDetailPage";
import { PokemonIndexPage } from "./routes/PokemonIndexPage";
import { RulesPage } from "./routes/RulesPage";
import { SoulLinkDetailPage } from "./routes/SoulLinkDetailPage";
import { TimelinePage } from "./routes/TimelinePage";

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<OverviewPage />} />
        <Route path="timeline" element={<TimelinePage />} />
        <Route path="pokemon" element={<PokemonIndexPage />} />
        <Route path="pokemon/:pokemonId" element={<PokemonDetailPage />} />
        <Route path="soul-links/:linkId" element={<SoulLinkDetailPage />} />
        <Route path="events/:eventId" element={<EventDetailPage />} />
        <Route path="map" element={<MapPage />} />
        <Route path="rules" element={<RulesPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
