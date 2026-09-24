import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { EditorApp } from "./EditorApp";
import "./styles/global.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Expected #root to exist.");
}

createRoot(root).render(
  <StrictMode>
    <EditorApp />
  </StrictMode>,
);
