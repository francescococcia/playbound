import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { levelFromUrl } from "./core/share";
import { usePlaybound } from "./core/store";
// Fonts (self-hosted, no CDN). CSS names: "Inter Variable", "Space Grotesk", "JetBrains Mono".
import "@fontsource-variable/inter";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
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
