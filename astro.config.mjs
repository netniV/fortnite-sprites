import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://fortnite-sprites.pages.dev",
  output: "static",
  build: { inlineStylesheets: "auto" },
});
