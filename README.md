# graph-db-demo: Atlas Search + $graphLookup for a Social Recommendation Feed

A Next.js + MongoDB Atlas demo showing how to combine **Atlas Search**
(fuzzy/prefix keyword matching) with **`$graphLookup`** (recursive graph
traversal) to power a "people you may know" feed for a travel social app —
ranking direct contacts above friends-of-friends, with a real-time "Sync
Contacts" action, a short-TTL edge cache, and a query inspector that shows
exactly what ran against MongoDB for every result.

Full write-up — data model, the aggregation pipelines, the ranking logic,
the caching strategy and why it's scoped the way it is: see
**[README-social-followers.md](./README-social-followers.md)**.

## Quick start

Requires Node ≥18 (Next.js 15) — if your default `node -v` is older, switch
first, e.g. `nvm use 20`.

```bash
cp .env.local.example .env.local   # set MONGODB_URI to an Atlas cluster
npm install
npm run seed:social                # seeds users/follows + creates the Atlas Search index
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — it redirects to `/contacts`.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` / `npm run start` — production build
- `npm run seed:social` — reset the demo data to its pristine seeded state
  (also available in-app via the "Reset Demo" button)
- `npm test` — runs the integration test for the sync flow against your
  configured Atlas cluster (`src/lib/socialGraph.test.ts`)
- `npm run lint`
