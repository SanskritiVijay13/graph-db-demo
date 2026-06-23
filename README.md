# graph-db-demo: Atlas Search + $graphLookup for a Social Recommendation Feed

A Next.js + MongoDB Atlas demo showing how to combine **Atlas Search**
(fuzzy/prefix keyword matching) with **`$graphLookup`** (recursive graph
traversal) to power a "people you may know" feed for a travel social app —
ranking direct contacts above friends-of-friends, with a real-time "Sync
Contacts" action and a query inspector that shows exactly what ran against
MongoDB for every result.

Full technical write-up — data model, the aggregation pipelines, ranking
logic, caching strategy: see
**[README-social-followers.md](./README-social-followers.md)**.

## Features

- **Hybrid ranking** — Atlas Search keyword matching combined with
  `$graphLookup` graph traversal; direct contacts always outrank
  friends-of-friends, even when both are reachable.
- **Real-time graph mutation** — "Sync Contacts" inserts live data and the
  ranked list reacts immediately.
- **Two graph views** — an ego-centric radial layout (distance = rank) and a
  full force-directed view of the entire database.
- **Query inspector** — the live Atlas Search index definition, a sample
  document, and the exact aggregation pipeline that ran, with real
  execution times, for every search.
- **Short-TTL edge cache** — caches raw edge-list reads, never a derived
  count, with explicit invalidation on writes.
- **Explorable profiles** — click into anyone's own followers/following and
  influence score, drilling deeper each time.

## Tech stack

| | |
|---|---|
| Frontend | Next.js 15 (App Router), React 18, TypeScript |
| Styling | TailwindCSS |
| Search & graph | MongoDB Atlas Search, `$graphLookup`, `$unionWith` |
| Visualization | D3.js (force-directed + radial layouts) |
| Database | MongoDB Atlas |
| Testing | Vitest |

## Prerequisites

- Node.js ≥18 (Next.js 15) — if your default `node -v` is older, switch
  first, e.g. `nvm use 20`
- A MongoDB **Atlas** cluster — Atlas Search requires Atlas specifically,
  not just any MongoDB; a free M0 tier works
- npm

## Getting started

```bash
cp .env.local.example .env.local   # set MONGODB_URI to your Atlas cluster
npm install
npm run seed:social                # seeds users/follows + creates the Atlas Search index
npm run dev
```

Open [http://localhost:3000/contacts](http://localhost:3000/contacts).

## Project structure

```
src/
├── app/
│   ├── contacts/          # the demo page
│   └── api/contacts/      # search, sync, reset, profile, graph routes
├── components/contacts/   # network graphs, profile panel, info tooltips
├── lib/                   # ranking pipelines, edge cache, seed logic
└── models/social.ts       # shared types
```

## Scripts

- `npm run dev` — start the dev server
- `npm run build` / `npm run start` — production build
- `npm run seed:social` — reset the demo data to its pristine seeded state
  (also available in-app via the "Reset Demo" button)
- `npm test` — runs the integration test for the sync flow against your
  configured Atlas cluster (`src/lib/socialGraph.test.ts`)
- `npm run lint`
