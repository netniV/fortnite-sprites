# Fortnite Sprites

An Astro-based Fortnite Sprite collection tracker. Selections are stored in the
browser and shared as compact, tagged query parameters for side-by-side comparison
and collection-aware social previews. Links using the previous fragment formats
remain supported.

## Commands

- `pnpm install` — install dependencies
- `pnpm run dev` — start the local server
- `pnpm run check` — run Astro and TypeScript checks
- `pnpm run build` — build the static site
- `pnpm run preview` — preview the production build

## Deploy to Cloudflare Workers

Connect this GitHub repository to a Cloudflare Workers Build and use these settings:

- Production branch: `main`
- Build command: `pnpm run build`
- Deploy command: `npx wrangler deploy`

The `wrangler.jsonc` configuration deploys the Astro output as Worker static assets
and runs `src/worker.ts` before the homepage asset. The Worker adds collection stats
to link-preview metadata when a shared URL is requested.

Node.js 22 is pinned in `.node-version`. Cloudflare Workers will rebuild the
production site after pushes to `main` and create preview deployments for pull
requests.

The Chapter 7 Season 4 catalog and artwork were captured from the public
[Fortnite.GG Sprite catalog](https://fortnite.gg/sprites) on 20 August 2026.
Fortnite and its assets are trademarks of Epic Games. This fan project is not
affiliated with Epic Games or Fortnite.GG.
