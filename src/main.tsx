import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter/index.css";
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import App from "./App";
import "./core/history"; // undo / redo (Ctrl+Z, Ctrl+Y)
import { levelFromUrl } from "./core/share";
import { usePlaybound } from "./core/store";
import "./index.css";
import "./ui/round4.css";

// Opened from a share link (#l=...)? Load that level instead of the default preset.
levelFromUrl().then((level) => {
  if (level) usePlaybound.getState().setLevel(level);
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
