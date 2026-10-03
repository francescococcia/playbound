import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { rodinDevPlugin } from "./server/rodinDevPlugin.ts";

export default defineConfig({
  plugins: [react(), rodinDevPlugin()],
});
