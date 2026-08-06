# Fortnite Sprites

An Astro-based Fortnite Sprite collection tracker. Selections are stored in the
browser and shared as compact, tagged URL fragments for side-by-side comparison.
Links using the original `#c=…&m=…` format remain supported.

## Commands

- `pnpm install` — install dependencies
- `pnpm run dev` — start the local server
- `pnpm run check` — run Astro and TypeScript checks
- `pnpm run build` — build the static site
- `pnpm run preview` — preview the production build

## Deploy to Cloudflare Pages

Import this GitHub repository into Cloudflare Pages and use these settings:

- Production branch: `main`
- Framework preset: `Astro`
- Build command: `pnpm run build`
- Build output directory: `dist`

Node.js 22 is pinned in `.node-version`. Cloudflare Pages will rebuild the
production site after pushes to `main` and create preview deployments for pull
requests.

The catalog and artwork were captured from the public
[Fortnite.GG Sprite catalog](https://fortnite.gg/sprites) on 6 August 2026.
Fortnite and its assets are trademarks of Epic Games. This fan project is not
affiliated with Epic Games or Fortnite.GG.
