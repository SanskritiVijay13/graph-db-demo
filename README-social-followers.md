# Travel Buddy Suggestions: Atlas Search + $graphLookup Demo

A "people you may know" feed for a travel social app: rank direct contacts
above friends-of-friends, break ties by mutual-connection count, respect
blocking. Built to show **Atlas Search** (keyword matching) combined with
**`$graphLookup`** (graph traversal) — not a general location-discovery
feature, so radius/city-based search is intentionally out of scope.

Live at `/contacts` once seeded — see [Running it](#running-it).

## Data model

Plain numeric IDs (not ObjectIds), so the seed data and the pipelines shown
in the UI stay readable.

```ts
// users
{ _id: ObjectId, userId: number, name: string, handle: string, city: string, country: string }

// follows (edge collection — also doubles as the block list)
{ _id: ObjectId, userId: number, fellowId: number, status: 0 | 3 } // 0 = active follow, 3 = blocked
```

Demo persona (hardcoded, no auth): `userId: 6, "Nigam Tiwari", "@nigamkr"`.

## Ranking model

| Tier | Meaning | Source |
|------|---------|--------|
| 1 | **Your Contact** — someone you directly follow | outward `$graphLookup`, hop 0 |
| 2 | **Friend of a Contact** — someone your contacts follow | outward `$graphLookup`, hop 1 |
| 3 | **Follows You** — a direct follower | follower `$graphLookup` base set |
| 4 | **Via a Follower** — someone your followers follow | follower `$graphLookup` extension |

Lower tier = higher rank; ties broken by `mutualCount` descending. Reachable
through more than one path? Classified by the **best** tier — the mechanism
behind "rank contacts higher than friends-of-friends." Blocking is symmetric:
any `status: 3` edge to/from the logged-in user, either direction, excluded.

## Atlas Search index

Matching is prefix/substring ("dev" must match "Developer Girl"), which a
standard text analyzer can't do — so the index uses `autocomplete` with
`edgeGram` tokenization on `name` and `handle`:

```json
{
  "name": "users_search",
  "definition": { "mappings": { "dynamic": false, "fields": {
    "name":   [{ "type": "autocomplete", "tokenization": "edgeGram", "minGrams": 2, "maxGrams": 15 }],
    "handle": [{ "type": "autocomplete", "tokenization": "edgeGram", "minGrams": 2, "maxGrams": 15 }]
  } } }
}
```

Created by `scripts/seed-social.ts` via the driver's `createSearchIndex`,
polling `listSearchIndexes` until `queryable: true`.

## How search and ranking combine

Two queries, not three — concurrent, not sequential:

```
Promise.all([
  $search on `users`                          (keyword match, knows nothing about the graph)
  $graphLookup × 2 joined by $unionWith        (outward + follower traversal, merged + sorted in Mongo)
])
→ once both resolve: keep graph candidates that also matched the search — the only step left in JS
```

The graph side (`buildCombinedGraphPipeline` in `socialGraph.ts`) is two
`$graphLookup` traversals stitched together, not two separate round-trips:

- **Outward half** — one root document (`$match: { userId: ME }` on
  `users`), so `$graphLookup` runs exactly once: `hop 0` = direct edges
  (Tier 1), `hop 1` = everywhere contacts lead (Tier 2).
  > ⚠️ Must run against `users` (one root), not `follows` (one doc *per
  > edge*) — a real bug caught while building this inflated mutual counts 3×.
- **`$unionWith`** — runs the follower traversal against `follows` instead
  (one input doc per follower, so `$graphLookup` fires once per follower),
  in the same round trip.
- **Final `$group` + `$sort`** — merges anyone reachable both ways (`$min`
  tier, `$sum` mutualCount) and ranks the result, server-side. The app layer
  never re-sorts or re-merges.

**Why the keyword filter stays in JS, not a third pipeline stage:** `$search`
must lead its own pipeline, and `$graphLookup` is cheapest rooted at *one*
user. Combining them in one pipeline would mean re-running the traversal
once per keyword match, or materializing one side into a temp collection —
not worth it here, so that one cheap intersection stays in application code.

Winning candidates' `via` (who connects you to them) becomes the edges drawn
in the network graph.

## Caching

Reading `me`'s contacts/followers/blocked list happens on nearly every
request. `getMyNetwork` (`socialGraph.ts`) wraps it in a 15s in-memory TTL
cache (`src/lib/edgeCache.ts`), explicitly invalidated right after the two
writes that change it (`syncNewContacts`, `resetSocialGraph`) so a write you
just made is never hidden behind stale data. Visible in the UI: `fetched
fresh (97ms)` → `cache hit (0.2ms)`.

**Deliberately not cached: the ranked list or any derived number like
`mutualCount`.** A mutual count can change from an edge nowhere near either
endpoint — unbounded invalidation fan-out. This mirrors how real platforms
handle it: Twitter fans out reads, not writes, for high-degree accounts;
Facebook's TAO caches edge reads, never the derived metric; LinkedIn's
"People You May Know" precomputes offline and accepts staleness at far
larger scale than this demo needs. We're doing the "cache the edges, not the
count" piece — the others are the next reach only if this had a celebrity
problem.

## The UI

- **Search box** — debounced, defaults to `"dev"`.
- **List view** — tier badges; mutual count shown only for Tiers 2 & 4
  (Tiers 1 & 3 are direct, so a count would be a meaningless artifact).
- **Network Graph** — fixed radial layout, not a physics simulation: each
  tier sits on its own ring so rank is always visually unambiguous. Click a
  node to open its profile panel.
- **Contact profile panel** — click a person (or their "N mutual
  connections" link) to see *their* actual followers/following, tagged
  against your network, plus an Influence Score (`followers × 10 +
  following`). Resolves via `$lookup`, not `$graphLookup` — no recursion
  needed for one hop. Click anyone inside to drill into *their* profile.
- **Show Index / Sample Doc / Show Query** — three buttons, one modal each,
  always sourced live from the API response (never a hardcoded example).
- **Query timing** — real execution time shown under the search box and per
  pipeline inside *Show Query*.
- **View Full Graph** — force-directed view of every user/edge in the
  database, colored by BFS reachability from you.

## Live demo: "Sync Contacts"

`POST /api/contacts/sync` (`syncNewContacts`) simulates importing 5 contacts
from your phone, landing one in **every** tier — two as new contacts you
follow (Tier 1), one as a new followee of an existing contact (Tier 2), one
as a new follower (Tier 3), one as a new followee of an existing follower
(Tier 4). Names are biased to start with whatever you're currently searching
so they're instantly findable.

The frontend **polls** the search endpoint for a few seconds rather than
refetching once — Atlas Search indexes new documents asynchronously, so an
immediate single refetch would often miss them. The same resilience (and a
request-sequencing guard against a slower stale fetch clobbering a faster
one) applies to every fetch, not just the one right after Sync.

**Reset Demo** (`POST /api/contacts/reset`) wipes and reseeds in place via
the same `resetSocialGraph` function the CLI seed script uses, so the two
paths can't drift apart.

## Running it

```bash
npm run seed:social   # seeds users/follows + creates the Atlas Search index
npm run dev
```

Then open `http://localhost:3000/contacts`.

### Seed data

`scripts/seed-social.ts` plants the brief's worked example almost verbatim:

- Nigam (6) follows Dev Sharma (99) and Ravi Kumar (100), and has **blocked**
  Developer Girl (101).
- 99 and 100 follow Dev Chauhan (102) / Devika Mehta (103) — Tier 2.
- Dev Patel (104) and Sara Khan (105) follow Nigam back — Tier 3 — and
  themselves follow 102/103/Alex Stone (106) — Tier 4.
- Devender Rao (107) and Devanshi Singh (109) match "dev" by name but are
  **deliberately disconnected** from Nigam's graph — proof the demo combines
  search with graph reachability, not keyword-matching alone.
- ~20 Faker-generated filler users (seeded with `faker.seed(42)` for
  reproducibility) only follow each other, isolated from the curated graph.
