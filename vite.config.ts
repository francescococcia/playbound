import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { aiDevPlugin } from "./server/aiDevPlugin.ts";
import { rodinDevPlugin } from "./server/rodinDevPlugin.ts";

export default defineConfig(({ mode }) => {
  // "" prefix = load ALL vars from .env, but only into this Node process (never the browser).
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), rodinDevPlugin(env.HYPER3D_API_KEY), aiDevPlugin(env.GEMINI_API_KEY)],
  };
});
