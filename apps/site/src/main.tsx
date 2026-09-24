import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "./App";
import { RunViewProvider } from "./context/RunViewContext";
import "./styles/global.css";

const root = document.getElementById("root");
if (!root) throw new Error("Expected #root to exist.");

const baseUrl = import.meta.env.BASE_URL;
const basename = baseUrl === "/" ? "/" : baseUrl.replace(/\/$/, "");

createRoot(root).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <RunViewProvider>
        <App />
      </RunViewProvider>
    </BrowserRouter>
  </StrictMode>,
);
