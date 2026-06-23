# Travel Buddy Suggestions: Atlas Search + $graphLookup Demo

A demo showing how to combine **MongoDB Atlas Search** (fuzzy/prefix keyword
matching) with **`$graphLookup`** (recursive graph traversal) to power a
"people you may know" recommendation feed for a travel social app.

It implements the ranking rules from the "User Search Logic Documentation"
brief: search my contact history (who I follow, who follows me, and their
connections), rank direct contacts above friends-of-friends, break ties by
mutual-connection count, and respect blocking.

Live at `/contacts` once seeded — see [Running it](#running-it) below.

## Why this exists

The brief described 5 query types. Two of them (radius search by lat/long,
and same-city/country matching) are plain `$match`/geospatial queries with no
graph traversal involved, so they're intentionally out of scope here — this
demo is specifically about `$graphLookup` and Atlas Search, not a full
location-discovery feature. The three that remain (direct contacts,
friends-of-friends via followings, friends-of-friends via followers) are
exactly what `$graphLookup` is built for.

## Data model

Two new collections in the same `graph-db-demo` database, using plain
numeric IDs (matching the brief's `User_ID`/`Fellow_ID` notation) instead of
ObjectIds, so the seed data and the pipelines shown in the UI stay readable.

```ts
// users
{ _id: ObjectId, userId: number, name: string, handle: string, city: string, country: string }

// follows (edge collection — also doubles as the block list)
{ _id: ObjectId, userId: number, fellowId: number, status: 0 | 3 } // 0 = active follow, 3 = blocked
```

The demo persona is hardcoded (no auth): `userId: 6, "Nigam Tiwari", "@nigamkr"`.

## Ranking model

Results are bucketed into 4 tiers. Lower tier number = higher priority; ties
within a tier are broken by `mutualCount` descending.

| Tier | Meaning | Source |
|------|---------|--------|
| 1 | **Your Contact** — someone you directly follow | outward `$graphLookup`, hop 0 |
| 2 | **Friend of a Contact** — someone your contacts follow | outward `$graphLookup`, hop 1 |
| 3 | **Follows You** — a direct follower | follower `$graphLookup` base set |
| 4 | **Via a Follower** — someone your followers follow | follower `$graphLookup` extension |

If a candidate is reachable through more than one path (e.g. both a direct
contact and a friend-of-a-friend), they're classified by their **best**
(lowest-numbered) tier — this is the concrete mechanism behind "rank my
contacts higher than the followings of my followings."

Blocking is symmetric: anyone with a `status: 3` edge to/from the logged-in
user, in either direction, is excluded before ranking.

## Atlas Search index

The brief's matching behavior is prefix/substring — searching `"dev"` must
match "Developer Girl", "Devika Mehta", "Devanshi Singh", not just a token
that starts with "dev" after whitespace splitting. A standard text index
analyzer wouldn't do this (it tokenizes "Developer" as one token, not as a
prefix-searchable string), so the index uses the `autocomplete` field type
with `edgeGram` tokenization on both `name` and `handle`:

```json
{
  "name": "users_search",
  "definition": {
    "mappings": {
      "dynamic": false,
      "fields": {
        "name":   [{ "type": "autocomplete", "tokenization": "edgeGram", "minGrams": 2, "maxGrams": 15 }],
        "handle": [{ "type": "autocomplete", "tokenization": "edgeGram", "minGrams": 2, "maxGrams": 15 }]
      }
    }
  }
}
```

Created by `scripts/seed-social.ts` via the Node driver's `createSearchIndex`
(supported since `mongodb` v6), with a poll loop against
`listSearchIndexes` until the index reports `queryable: true`.

## Search flow: how the 3 queries combine

There are conceptually three queries — keyword search, an outward graph
traversal, and a follower-side graph traversal — but only **two real
round-trips to MongoDB**, because the two graph traversals are stitched into
one pipeline with `$unionWith`. All of it lives in `src/lib/socialGraph.ts`
as plain functions that *build* the pipeline arrays — the API route executes
them and returns them verbatim in the response, so what you see in the "Show
Query" modal is never out of sync with what actually ran.

```
searchAndRankContacts(db, "dev")
│
├─ Promise.all([                                    ← both fire concurrently, neither waits on the other
│    Query 1: buildSearchPipeline("dev")             — $search on `users`
│    Query 2: buildCombinedGraphPipeline(me)          — $graphLookup × 2, joined with $unionWith, on `users`
│  ])
│
└─ once both resolve: intersect Query 2's candidates with Query 1's matches   ← the only step left in JS
```

### Query 1 — Atlas Search: keyword → candidate profiles

```js
db.users.aggregate([
  { $search: { index: "users_search", compound: { should: [
      { autocomplete: { query, path: "name" } },
      { autocomplete: { query, path: "handle" } }
    ], minimumShouldMatch: 1 } } },
  { $project: { _id: 0, userId: 1, name: 1, handle: 1, city: 1, country: 1, score: { $meta: "searchScore" } } }
])
```

Knows nothing about the graph — it's a pure keyword match against `users`.

### Query 2 — the combined graph pipeline: Tiers 1–4, merged and sorted in MongoDB

`buildCombinedGraphPipeline` (`socialGraph.ts`) is two `$graphLookup`
traversals glued together with `$unionWith`, followed by a `$group` that does
the merging and a `$sort` that does the ranking — all server-side:

```js
db.users.aggregate([
  // --- outward traversal: Tiers 1 & 2 ---
  { $match: { userId: ME } },
  { $graphLookup: {
      from: "follows", startWith: "$userId",
      connectFromField: "fellowId", connectToField: "userId",
      maxDepth: 1, depthField: "hop", as: "network",
      restrictSearchWithMatch: { status: { $ne: 3 } } } },
  { $unwind: "$network" },
  { $group: { _id: "$network.fellowId", minHop: { $min: "$network.hop" },
              mutualCount: { $sum: 1 }, via: { $push: "$network.userId" } } },
  { $match: { _id: { $ne: ME } } },
  { $project: { userId: "$_id", tier: { $cond: [{ $eq: ["$minHop", 0] }, 1, 2] },
                mutualCount: 1, via: 1, _id: 0 } },

  // --- $unionWith: follower traversal, Tiers 3 & 4, run against a DIFFERENT collection ---
  { $unionWith: { coll: "follows", pipeline: [
      { $match: { fellowId: ME, status: { $ne: 3 } } },
      { $graphLookup: {
          from: "follows", startWith: "$userId",
          connectFromField: "fellowId", connectToField: "userId",
          maxDepth: 0, as: "theirFollows",
          restrictSearchWithMatch: { status: { $ne: 3 } } } },
      { $facet: {
          directFollowers: [{ $project: { userId: "$userId", tier: { $literal: 3 },
                                            mutualCount: { $literal: 0 }, _id: 0 } }],
          followerConnections: [
            { $unwind: "$theirFollows" },
            { $group: { _id: "$theirFollows.fellowId", mutualCount: { $sum: 1 },
                        via: { $push: "$userId" } } },
            { $project: { userId: "$_id", tier: { $literal: 4 }, mutualCount: 1, via: 1, _id: 0 } } ] } },
      { $project: { combined: { $concatArrays: ["$directFollowers", "$followerConnections"] } } },
      { $unwind: "$combined" }, { $replaceRoot: { newRoot: "$combined" } },
  ] } },

  // --- merge anyone reachable both ways, then rank ---
  { $group: { _id: "$userId", tier: { $min: "$tier" }, mutualCount: { $sum: "$mutualCount" },
              viaArrays: { $push: "$via" } } },
  { $project: { userId: "$_id", tier: 1, mutualCount: 1,
                via: { $reduce: { input: "$viaArrays", initialValue: [],
                                   in: { $concatArrays: ["$$value", { $ifNull: ["$$this", []] }] } } },
                _id: 0 } },
  { $sort: { tier: 1, mutualCount: -1 } }
])
```

Why each piece:
- **Outward half**: runs against `users` matching exactly one root document,
  so `$graphLookup` executes exactly once: `hop: 0` is my direct edges, `hop:
  1` is everywhere my contacts lead.
- **`$unionWith`**: lets the second traversal run against a *different*
  collection (`follows`, one input document per follower — not a single
  root) than the base pipeline (`users`), in the same round trip. `$match`
  there deliberately emits one document per follower so `$graphLookup` runs
  once per follower; grouping afterward yields an accurate count of how many
  distinct followers lead to each candidate.
- **The final `$group`**: a candidate can legitimately come back from *both*
  halves (reachable via a contact *and* a follower). Taking `$min` on tier
  and `$sum` on `mutualCount` is what makes a direct contact always outrank a
  friend-of-a-friend, even when reachable both ways — and it's why Dev
  Chauhan's mutual count is the *combined* total (contacts + followers who
  lead to him), not just one side of it.
- **The final `$sort`**: by the time this query returns, the list is already
  in final rank order. The app layer never re-sorts it.

> ⚠️ The outward half must run against `users` (one root doc), not `follows`
> (which has one doc *per edge*). Running it against `follows` was a real bug
> caught while building this — `$graphLookup` fired once per edge, including
> the blocked one, and mutual counts came out **3× inflated**.

### What's left in application code — and why it stays there

`searchAndRankContacts` filters Query 2's (already merged, already sorted)
candidates down to the ones that also appear in Query 1's matches, and drops
blocked ids. That's it — no merging, no sorting, just a `.filter()` that
preserves the incoming order.

This intersection deliberately isn't a third pipeline stage. `$search` has to
lead its own pipeline, and `$graphLookup` is cheapest rooted at *one* user
(you). Folding the keyword filter into the same pipeline as the traversal
would mean either re-running the outward-from-you traversal once per search
match (an expensive correlated `$lookup`) or materializing one side into a
temp collection first (`$merge`/`$out`) — neither pays for itself at this
scale, so the one cheap JS step stays in JS rather than becoming an expensive
MongoDB one.

The winning candidates' `via` arrays (who connects me to that candidate) get
turned into the edges rendered in the network graph — e.g. tier 2's
`via: [99, 100]` becomes the edges `99 → candidate` and `100 → candidate`.

## Caching: what's cached, what deliberately isn't

### Why: real social platforms never cache the derived number either

A mutual-connection count can change because of an edge *nowhere near* either
endpoint — someone you've never met following one of your contacts can flip
a count between you and a third person. That invalidation fan-out is
unbounded, so production systems don't fight it. The condensed playbook:

- **Fan-out-on-read vs fan-out-on-write** — Twitter's timeline problem, same
  shape as ours. Push-on-write (instant reads, unbounded write cost for a
  celebrity's followers) vs pull-on-read (cheap writes, a per-read cost).
  Twitter hybridizes: write-fanout for normal accounts, read-fanout for
  celebrities. Our `$graphLookup` rooted at *you*, computed live, already
  *is* fan-out-on-read — the right default here, not a shortcut.
- **Cache the cheap input, not the expensive output** — Facebook's TAO
  caches edge-list reads in front of MySQL; mutual-friend math still runs as
  a live set-intersection against those fast reads. This is that pattern.
- **Precompute offline, accept staleness** — LinkedIn's "People You May
  Know" doesn't compute mutuals on page load; a batch/stream pipeline
  precomputes candidates per user periodically. Worth the staleness only at
  billions-of-edges scale — not this demo.
- **Sample instead of exact, for high-degree nodes** — "50+ mutual
  connections" usually means a capped traversal (e.g. only your N
  most-recently-active connections), not a UI rounding choice.

We're squarely in pattern 2 today — cache the edges, not the count — because
this demo doesn't have pattern 1's celebrity problem (no one here has
millions of followers). Patterns 3 and 4 are the next reach, in that order,
*if* it ever did.

### What we actually built

"Drops blocked ids" above means reading `me`'s edges (contacts, followers,
blocked) on basically every request — every search keystroke, every profile
panel open, every sync. That read is small, repeats constantly for the same
user within a session, and barely ever changes — exactly the shape of read
worth caching. `getMyNetwork` (`socialGraph.ts`) wraps it in a 15-second
in-memory TTL cache (`src/lib/edgeCache.ts`) and consolidates what used to be
up to three separate queries (contacts / followers / blocked) into one:

```js
db.follows.find({ $or: [{ userId: me }, { fellowId: me }] })
// then partitioned in JS into contactIds / followerIds / blockedIds by status + direction
```

**What's deliberately *not* cached: the ranked result list, or any derived
number like `mutualCount`** — see "Why" above. Caching `me`'s own raw edges
is safe because only `me` following/unfollowing someone changes them.

Two correctness mechanisms work together, not one:
- **TTL (15s)** — the general backstop. Handles staleness from any future
  write path that forgets to invalidate.
- **Explicit invalidation** on the two writes this app actually makes:
  `syncNewContacts` calls `invalidateMyNetwork(me)` right after inserting
  (two of the five new edges touch `me` directly), and `resetSocialGraph`
  calls `clearCache()` after reseeding everything. Both mean a write you just
  made is reflected on your very next request — you never have to wait out
  the TTL for your own action.

Visible proof in the UI: the small line under the search box reads `fetched
fresh (97ms)` on a cold read and `cache hit (0.2ms)` immediately after —
~500× faster, sourced from `timings.myNetwork` / `timings.myNetworkCacheHit`
in the API response, not a hardcoded claim.

One dev-mode caveat: `next dev` (Turbopack) occasionally reinitializes route
modules between requests, which resets the cache's top-level `Map` along
with it — so hit rates look lower in dev than they will in a production
build (`next build && next start`), where modules stay resident.

## The UI

- **Search box** (`src/app/contacts/page.tsx`) — debounced, defaults to `"dev"`.
- **List view** — results badged by tier, with a mutual-connection count
  shown only for Tiers 2 & 4 (Tiers 1 & 3 are direct relationships, so a
  "mutual" count there would be a meaningless artifact of the single edge).
- **Network Graph view** (`src/components/contacts/ContactNetworkGraph.tsx`)
  — an SVG radial layout, not a physics simulation: "me" is the center, and
  each tier sits on its own fixed concentric ring (closer = higher rank), with
  lines drawn for the actual `via` edges. A force simulation could happen to
  place a Tier 2 node closer to center than a Tier 1 node depending on how it
  settles — fixing the radius by tier guarantees the ranking is always
  visually unambiguous, which is the whole point of the demo. Clicking any
  node opens that person's profile panel (see below).
- **Contact profile panel** (`src/components/contacts/ContactProfilePanel.tsx`)
  — clicking a result's "N mutual connections" text, a result row, or a graph
  node slides in a right-hand panel showing that person's own social graph:
  who they actually follow and who actually follows them (not just counts),
  which of those are people in *your* network (tagged "via your contact" /
  "via your follower" — the named answer to the count shown in the list), and
  an Influence Score (`followers × 10 + following`) — the same
  click-a-node → see-their-detail-panel pattern most network dashboards use,
  adapted to this graph: `getContactProfile` in `src/lib/socialGraph.ts` resolves direct
  connections via `$lookup` (not `$graphLookup` — there's no recursion to
  show here, just direct joins) against `GET /api/contacts/profile/[userId]`.
  Clicking any person inside the panel re-fetches and drills into *their*
  profile, so it's a small explorable graph, not a dead-end card.
- **Three inspector buttons** — "Show Index", "Sample Doc", and "Show Query"
  each open the same modal scoped to one concern, rather than one button
  dumping everything at once:
  - *Show Index* — the live Atlas Search index definition.
  - *Sample Doc* — one raw document from `users` and one from `follows`
    (`getSampleDocs` in `src/lib/socialGraph.ts`), so it's obvious what
    shape of data the index/pipelines above are actually operating on.
  - *Show Query* — both queries (Atlas Search and the combined graph
    pipeline) as formatted JSON, each one labeled
    with its own real execution time (see Timing below). All of this is
    sourced directly from the API response, so it's always showing what
    actually executed, never a hardcoded example.
- **Query timing** — `query executed in Xms` under the search box on every
  search, and a per-pipeline breakdown inside the *Show Query* modal (e.g.
  `$graphLookup — ... — 12ms`). Measured server-side in
  `searchAndRankContacts` by timing each pipeline's `aggregate().toArray()`
  individually rather than timing the `Promise.all` as a whole, since they
  run concurrently — a single wall-clock total would only ever reflect the
  slowest one, not each pipeline's actual cost.

## Live demo: "Sync Contacts"

The most convincing way to show this in action is to mutate the graph while
it's on screen and watch the ranking react. The **Sync Contacts** button
(`POST /api/contacts/sync`, implemented in `syncNewContacts` in
`src/lib/socialGraph.ts`) simulates importing 5 new contacts from your phone:

- It inserts 5 brand-new `users` documents and attaches each one to the
  *existing* graph at a different point, landing one in **every** tier: two
  become direct contacts of yours (Tier 1), one is attached as a new
  followee of one of your existing contacts (Tier 2), one follows you back
  (Tier 3), and one is attached as a new followee of one of your existing
  followers (Tier 4).
- Their generated name and handle are biased to start with whatever you're
  currently searching for (e.g. `"dev"` → `"Devxyz Whoever"`, `@devxyz1234`),
  so they're guaranteed to be findable immediately — without this, you'd have
  to know to search a brand-new random name to ever see them.
- The frontend then **polls** the search endpoint for up to ~3 seconds before
  giving up, rather than refetching once: Atlas Search indexes new documents
  asynchronously, so there's normally a sub-second lag between the insert and
  the new contacts becoming searchable. A single immediate refetch would
  often miss them and undersell the "real-time" effect. This resilience lives
  in one shared `fetchResultsResilient` helper (`src/app/contacts/page.tsx`)
  used by *every* fetch, not just the one right after clicking Sync — the
  ids the last sync inserted are remembered in a ref, so a later re-search or
  even a full page reload also waits for them rather than only the very next
  request. A request-sequencing counter alongside it discards any fetch whose
  result resolves after a newer one has already landed, so typing in the
  search box while a sync's own fetch is still in flight can't make a slower,
  staler response clobber a faster, more complete one.
- Newly synced contacts get a `NEW` badge in the list view and a pulsing
  Spring Green ring in the graph view (`highlightIds` prop on `ContactRow` /
  `ContactNetworkGraph`) until the next sync replaces the highlight set.

Each click grows the graph further (ids keep incrementing from the current
max `userId`), so it's safe to click repeatedly during a live demo. The
**Reset Demo** button (`POST /api/contacts/reset`) wipes `users`/`follows`
and reseeds the pristine state in place — it calls the exact same
`resetSocialGraph` function (`src/lib/seedSocialGraph.ts`) that
`npm run seed:social` uses, so the two paths can't drift apart. It doesn't
touch the Atlas Search index, since that's attached to the collection and
keeps tracking whatever documents exist after the reset automatically.

## Running it

Requires Node ≥18 (Next.js 15) — if your default `node -v` is older, switch
first, e.g. `nvm use 20`.

```bash
npm run seed:social   # seeds users/follows + creates the Atlas Search index
npm run dev
```

Then open `http://localhost:3000/contacts`.

### Seed data

`scripts/seed-social.ts` plants the brief's worked example almost verbatim:

- Nigam (6) follows Dev Sharma (99) and Ravi Kumar (100), and has **blocked**
  Developer Girl (101).
- 99 and 100 follow Dev Chauhan (102) / Devika Mehta (103) — Tier 2 candidates.
- Dev Patel (104) and Sara Khan (105) follow Nigam back — Tier 3 — and
  themselves follow 102/103/Alex Stone (106) — Tier 4 candidates.
- Devender Rao (107) and Devanshi Singh (109) match "dev" by name but are
  **deliberately left disconnected** from Nigam's graph, to prove the demo
  combines search with graph reachability rather than keyword-matching alone
  — they should never appear in results.
- ~20 Faker-generated filler users (seeded with `faker.seed(42)` for
  reproducibility) round out the `users` collection; they only follow each
  other, kept isolated from the curated graph so the demo stays predictable.
