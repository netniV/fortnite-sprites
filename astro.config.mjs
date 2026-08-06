import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://fortnite-sprites.netniv.workers.dev",
  output: "static",
  build: { inlineStylesheets: "auto" },
});
