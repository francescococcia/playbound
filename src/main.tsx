import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { levelFromUrl } from "./core/share";
import { usePlaybound } from "./core/store";
import "./index.css";

// Opened from a share link (#l=...)? Load that level instead of the default preset.
levelFromUrl().then((level) => {
  if (level) usePlaybound.getState().setLevel(level);
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
