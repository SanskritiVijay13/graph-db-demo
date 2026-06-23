import { Db, Document } from 'mongodb';
import { faker } from '@faker-js/faker';
import { ContactTier, FollowEdge, RankedContact, SocialUser, SyncedContact } from '@/models/social';
import { pickDemoLocation } from '@/lib/demoLocations';
import { cached, invalidateCached } from '@/lib/edgeCache';

export const CURRENT_USER_ID = 6;
export const SEARCH_INDEX_NAME = 'users_search';

export const SEARCH_INDEX_DEFINITION = {
  name: SEARCH_INDEX_NAME,
  definition: {
    mappings: {
      dynamic: false,
      fields: {
        name: [{ type: 'autocomplete', tokenization: 'edgeGram', minGrams: 2, maxGrams: 15 }],
        handle: [{ type: 'autocomplete', tokenization: 'edgeGram', minGrams: 2, maxGrams: 15 }],
      },
    },
  },
};

export function buildSearchPipeline(query: string): Document[] {
  return [
    {
      $search: {
        index: SEARCH_INDEX_NAME,
        compound: {
          should: [
            { autocomplete: { query, path: 'name' } },
            { autocomplete: { query, path: 'handle' } },
          ],
          minimumShouldMatch: 1,
        },
      },
    },
    {
      $project: {
        _id: 0,
        userId: 1,
        name: 1,
        handle: 1,
        city: 1,
        country: 1,
        score: { $meta: 'searchScore' },
      },
    },
  ];
}

// Tier 1 = direct contacts (people I follow), Tier 2 = who they follow.
// A single $graphLookup traversal from me, depth tags which tier a candidate falls into.
export function buildOutwardGraphPipeline(me: number = CURRENT_USER_ID): Document[] {
  return [
    { $match: { userId: me } },
    {
      $graphLookup: {
        from: 'follows',
        startWith: '$userId',
        connectFromField: 'fellowId',
        connectToField: 'userId',
        maxDepth: 1,
        depthField: 'hop',
        as: 'network',
        restrictSearchWithMatch: { status: { $ne: 3 } },
      },
    },
    { $unwind: '$network' },
    {
      $group: {
        _id: '$network.fellowId',
        minHop: { $min: '$network.hop' },
        mutualCount: { $sum: 1 },
        via: { $push: '$network.userId' }, // who connects me to this candidate
      },
    },
    { $match: { _id: { $ne: me } } },
    {
      $project: {
        _id: 0,
        userId: '$_id',
        tier: { $cond: [{ $eq: ['$minHop', 0] }, 1, 2] },
        mutualCount: 1,
        via: 1,
      },
    },
  ];
}

// Tier 3 = people who follow me, Tier 4 = who those followers follow.
// $match emits one input doc per follower, so $graphLookup runs once per follower and
// grouping afterward yields an accurate mutual-connection count.
export function buildFollowerGraphPipeline(me: number = CURRENT_USER_ID): Document[] {
  return [
    { $match: { fellowId: me, status: { $ne: 3 } } },
    {
      $graphLookup: {
        from: 'follows',
        startWith: '$userId',
        connectFromField: 'fellowId',
        connectToField: 'userId',
        maxDepth: 0,
        as: 'theirFollows',
        restrictSearchWithMatch: { status: { $ne: 3 } },
      },
    },
    {
      $facet: {
        directFollowers: [
          { $project: { _id: 0, userId: '$userId', tier: { $literal: 3 }, mutualCount: { $literal: 0 } } },
        ],
        followerConnections: [
          { $unwind: '$theirFollows' },
          {
            $group: {
              _id: '$theirFollows.fellowId',
              mutualCount: { $sum: 1 },
              via: { $push: '$userId' }, // which of my followers connects me to this candidate
            },
          },
          { $project: { _id: 0, userId: '$_id', tier: { $literal: 4 }, mutualCount: 1, via: 1 } },
        ],
      },
    },
    { $project: { combined: { $concatArrays: ['$directFollowers', '$followerConnections'] } } },
    { $unwind: '$combined' },
    { $replaceRoot: { newRoot: '$combined' } },
    { $match: { userId: { $ne: me } } },
  ];
}

interface GraphCandidate {
  userId: number;
  tier: ContactTier;
  mutualCount: number;
  via?: number[];
}

// Combines the outward and follower traversals into a single MongoDB round
// trip via $unionWith, then merges duplicate candidates - tier takes the best
// (lowest) of the two, mutualCount is summed, via is concatenated - and sorts,
// all server-side. This replaces what used to be a JS Map-based merge plus a
// JS .sort() after two separate .aggregate() calls.
//
// Deliberately NOT also folding the Atlas Search intersection into this same
// pipeline: $search must lead its own pipeline, and $graphLookup is cheapest
// rooted at one user (you) - combining "1 traversal root" with "N keyword
// matches" in one pipeline means either re-running the traversal once per
// search match (correlated $lookup) or materializing one side into a temp
// collection first ($merge/$out). Neither is worth it for a read path this
// small, so that intersection stays in application code (searchAndRankContacts).
export function buildCombinedGraphPipeline(me: number = CURRENT_USER_ID): Document[] {
  return [
    ...buildOutwardGraphPipeline(me),
    {
      $unionWith: {
        coll: 'follows',
        pipeline: buildFollowerGraphPipeline(me),
      },
    },
    {
      $group: {
        _id: '$userId',
        tier: { $min: '$tier' },
        mutualCount: { $sum: '$mutualCount' },
        viaArrays: { $push: '$via' },
      },
    },
    {
      $project: {
        _id: 0,
        userId: '$_id',
        tier: 1,
        mutualCount: 1,
        via: {
          $reduce: {
            input: '$viaArrays',
            initialValue: [],
            in: { $concatArrays: ['$$value', { $ifNull: ['$$this', []] }] },
          },
        },
      },
    },
    { $sort: { tier: 1, mutualCount: -1 } },
  ];
}

export interface GraphEdge {
  source: number;
  target: number;
}

// Builds the edges that justify each candidate's tier, e.g. "Dev Sharma -> Dev Chauhan"
// for a tier-2 friend-of-a-friend. Only edges between nodes present in the final result
// set are kept, so an edge through a contact who didn't match the search keyword is
// simply omitted rather than fetched separately.
function buildGraphEdges(me: number, candidates: GraphCandidate[], nodeIds: Set<number>): GraphEdge[] {
  const seen = new Set<string>();
  const edges: GraphEdge[] = [];

  const addEdge = (source: number, target: number) => {
    if (!nodeIds.has(source) || !nodeIds.has(target)) return;
    const key = `${source}->${target}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ source, target });
  };

  for (const candidate of candidates) {
    if (candidate.tier === 1) {
      addEdge(me, candidate.userId);
    } else if (candidate.tier === 3) {
      addEdge(candidate.userId, me);
    } else {
      for (const connector of candidate.via ?? []) {
        addEdge(connector, candidate.userId);
      }
    }
  }

  return edges;
}

async function timed<T>(fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const start = performance.now();
  const result = await fn();
  return { result, ms: Math.round((performance.now() - start) * 100) / 100 };
}

export interface MyNetwork {
  contactIds: Set<number>; // who I directly follow
  followerIds: Set<number>; // who directly follows me
  blockedIds: Set<number>; // blocked in either direction
}

async function fetchMyNetwork(db: Db, me: number): Promise<MyNetwork> {
  // One query for every edge touching me, partitioned in JS, instead of three
  // separate queries (contacts / followers / blocked) - this is exactly the
  // "edge-list read" the caching wraps, in its smallest form.
  const edges = await db
    .collection<FollowEdge>('follows')
    .find({ $or: [{ userId: me }, { fellowId: me }] })
    .toArray();

  const network: MyNetwork = { contactIds: new Set(), followerIds: new Set(), blockedIds: new Set() };
  for (const edge of edges) {
    if (edge.status === 3) {
      network.blockedIds.add(edge.userId === me ? edge.fellowId : edge.userId);
      continue;
    }
    if (edge.userId === me) network.contactIds.add(edge.fellowId);
    if (edge.fellowId === me) network.followerIds.add(edge.userId);
  }
  return network;
}

function myNetworkCacheKey(me: number): string {
  return `myNetwork:${me}`;
}

// The short-TTL cache target: this exact read (my direct contacts, followers,
// and blocked ids) is repeated on every search keystroke, every profile-panel
// open, and every sync - all for the same `me`, which barely ever changes
// within a session. Cache hit/miss is returned alongside the value so callers
// can surface it (see the timings.myNetworkCacheHit field in the search API).
export async function getMyNetwork(db: Db, me: number = CURRENT_USER_ID): Promise<{ network: MyNetwork; hit: boolean }> {
  const { value, hit } = await cached(myNetworkCacheKey(me), () => fetchMyNetwork(db, me));
  return { network: value, hit };
}

// Called right after the two places that actually mutate edges touching
// `me` (syncNewContacts, resetSocialGraph) - the TTL alone would also catch
// up within a few seconds, but invalidating immediately means a sync's own
// follow-up search never has to wait it out.
export function invalidateMyNetwork(me: number = CURRENT_USER_ID): void {
  invalidateCached(myNetworkCacheKey(me));
}

export async function searchAndRankContacts(db: Db, query: string, me: number = CURRENT_USER_ID) {
  const overallStart = performance.now();
  const searchPipeline = buildSearchPipeline(query);
  const graphPipeline = buildCombinedGraphPipeline(me);

  const [searchTimed, graphTimed, myNetworkTimed] = await Promise.all([
    timed(() => db.collection<SocialUser>('users').aggregate<SocialUser & { score: number }>(searchPipeline).toArray()),
    timed(() => db.collection('users').aggregate<GraphCandidate>(graphPipeline).toArray()),
    timed(() => getMyNetwork(db, me)),
  ]);

  const matchedProfiles = searchTimed.result;
  const graphCandidates = graphTimed.result; // already merged (best tier, summed mutualCount) and sorted by MongoDB
  const { blockedIds } = myNetworkTimed.result.network;
  const myNetworkCacheHit = myNetworkTimed.result.hit;

  const profileById = new Map(matchedProfiles.map((p) => [p.userId, p]));

  // The merge and sort already happened server-side in buildCombinedGraphPipeline
  // ($unionWith + $group + $sort). All that's left here is intersecting with the
  // Atlas Search keyword match and excluding blocked users - .filter() preserves
  // the incoming (already-sorted) order, so no re-sort is needed.
  const winningCandidates = graphCandidates.filter(
    (c) => c.userId !== me && !blockedIds.has(c.userId) && profileById.has(c.userId),
  );

  const results: RankedContact[] = winningCandidates.map((candidate) => {
    const profile = profileById.get(candidate.userId)!;
    return { ...profile, tier: candidate.tier, mutualCount: candidate.mutualCount };
  });

  const nodeIds = new Set<number>([me, ...results.map((r) => r.userId)]);
  const edges = buildGraphEdges(me, winningCandidates, nodeIds);

  return {
    results,
    graph: {
      nodes: [
        { userId: me, tier: 0 as const },
        ...results.map((r) => ({ userId: r.userId, tier: r.tier })),
      ],
      edges,
    },
    pipelines: {
      search: searchPipeline,
      graph: graphPipeline,
    },
    timings: {
      search: searchTimed.ms,
      graph: graphTimed.ms,
      myNetwork: myNetworkTimed.ms,
      myNetworkCacheHit,
      total: Math.round((performance.now() - overallStart) * 100) / 100,
    },
  };
}

export async function getSampleDocs(db: Db, me: number = CURRENT_USER_ID) {
  const [user, follow] = await Promise.all([
    db.collection('users').findOne<SocialUser>({ userId: me }, { projection: { _id: 0 } }),
    db.collection('follows').findOne<FollowEdge>({ userId: me, status: 0 }, { projection: { _id: 0 } }),
  ]);
  return { user, follow };
}

// Resolves a person's direct followings/followers to actual profiles (not
// just counts) via $lookup - this is what powers clicking into a contact's
// own social graph instead of only seeing an aggregate mutual-connection count.
//
// Deliberately $lookup, not $graphLookup: $graphLookup's recursive traversal
// machinery (cycle detection, depth tracking, repeated queries per hop) only
// pays for itself when you actually need >1 hop, which the ranking pipelines
// above do. This only ever needs exactly one hop, so $graphLookup with
// maxDepth: 0 would just be a slower, more complex way to write a $lookup.
//
// Each join here uses the plain localField/foreignField form rather than a
// $lookup-with-pipeline + $expr equality, so the join itself deterministically
// uses the userId/fellowId indexes (the `follows` lookups hit the
// userId_status/fellowId_status compound indexes on their leading field; the
// `users` lookups hit the unique userId index). The status:3 (blocked) filter
// is applied afterward with $filter, operating on the already-small per-user
// edge array rather than needing its own index.
export function buildProfilePipeline(userId: number): Document[] {
  return [
    { $match: { userId } },
    { $lookup: { from: 'follows', localField: 'userId', foreignField: 'userId', as: 'followingEdges' } },
    { $lookup: { from: 'follows', localField: 'userId', foreignField: 'fellowId', as: 'followerEdges' } },
    {
      $addFields: {
        followingEdges: { $filter: { input: '$followingEdges', cond: { $ne: ['$$this.status', 3] } } },
        followerEdges: { $filter: { input: '$followerEdges', cond: { $ne: ['$$this.status', 3] } } },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'followingEdges.fellowId',
        foreignField: 'userId',
        as: 'directFollowing',
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'followerEdges.userId',
        foreignField: 'userId',
        as: 'directFollowers',
      },
    },
    {
      $addFields: {
        // A simple influence score: followers count for more than followings,
        // since being followed is the stronger signal of network position.
        influenceScore: {
          $add: [{ $multiply: [{ $size: '$directFollowers' }, 10] }, { $size: '$directFollowing' }],
        },
      },
    },
    {
      $project: {
        _id: 0,
        userId: 1,
        name: 1,
        handle: 1,
        city: 1,
        country: 1,
        directFollowing: { $map: { input: '$directFollowing', as: 'u', in: PROFILE_FIELDS } },
        directFollowers: { $map: { input: '$directFollowers', as: 'u', in: PROFILE_FIELDS } },
        influenceScore: 1,
      },
    },
  ];
}

const PROFILE_FIELDS = {
  userId: '$$u.userId',
  name: '$$u.name',
  handle: '$$u.handle',
  city: '$$u.city',
  country: '$$u.country',
};

export async function getContactProfile(db: Db, userId: number, me: number = CURRENT_USER_ID) {
  const pipeline = buildProfilePipeline(userId);
  const [profileResult, myNetworkResult] = await Promise.all([
    db.collection('users').aggregate(pipeline).toArray(),
    getMyNetwork(db, me), // same short-TTL cache the search/ranking flow uses
  ]);
  const [doc] = profileResult;
  if (!doc) return null;

  const { contactIds: myContactIds, followerIds: myFollowerIds } = myNetworkResult.network;

  // Mutual connections = people in MY immediate network (someone I follow, or
  // someone who follows me) who also follow this person - the same definition
  // the ranking tiers use to compute "via" / mutualCount, just named here.
  const directFollowers = (doc.directFollowers ?? []) as SocialUser[];
  const mutualConnections = directFollowers
    .filter((u) => u.userId !== me && (myContactIds.has(u.userId) || myFollowerIds.has(u.userId)))
    .map((u) => ({ ...u, via: myContactIds.has(u.userId) ? ('contact' as const) : ('follower' as const) }));

  return {
    profile: { userId: doc.userId, name: doc.name, handle: doc.handle, city: doc.city, country: doc.country },
    influenceScore: doc.influenceScore as number,
    directFollowing: doc.directFollowing as SocialUser[],
    directFollowers,
    mutualConnections,
    pipeline,
  };
}

// Bias the generated name/handle to start with the active search query, so a
// "synced" contact is guaranteed to be findable immediately - the autocomplete
// index matches on a token prefix, so the first name token (and the handle)
// need to literally start with the query rather than just contain it.
function generateSyncedProfile(query: string, seed: number): { name: string; handle: string } {
  const cleanQuery = query.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const lastName = faker.person.lastName();

  if (!cleanQuery) {
    return {
      name: `${faker.person.firstName()} ${lastName}`,
      handle: `@${faker.internet.username().toLowerCase().replace(/[^a-z0-9_]/g, '')}${seed}`,
    };
  }

  const suffix = faker.string.alpha({ length: 3, casing: 'lower' });
  const firstName = cleanQuery.charAt(0).toUpperCase() + cleanQuery.slice(1) + suffix;
  return {
    name: `${firstName} ${lastName}`,
    handle: `@${cleanQuery}${faker.string.alphanumeric({ length: 4, casing: 'lower' })}`,
  };
}

// Simulates a "contacts sync" from a phone: adds 5 brand-new users to the
// graph, one landing in each tier, by attaching them to the existing graph at
// an already-seeded contact and follower. Only the Tier 1 and Tier 3 users
// become real direct connections (you<->them); the Tier 2 and Tier 4 users
// are attached to an EXISTING contact/follower instead, so they show up as
// 2nd-degree without ever getting an edge to `me` - intentional, so one click
// demonstrates all 4 ranking tiers reacting, not just "you now follow 5
// people." The UI surfaces this distinction explicitly (see the Sync
// Contacts info tooltip and post-sync status message in contacts/page.tsx)
// so it isn't a silent surprise.
export async function syncNewContacts(db: Db, query: string, me: number = CURRENT_USER_ID) {
  const start = performance.now();
  const [maxUserDoc] = await db.collection('users').find().sort({ userId: -1 }).limit(1).toArray();
  const startId = (maxUserDoc?.userId ?? 0) + 1;

  const anchorContact = await db.collection('follows').findOne<FollowEdge>({ userId: me, status: 0 });
  const anchorFollower = await db.collection('follows').findOne<FollowEdge>({ fellowId: me, status: 0 });

  const ids = [startId, startId + 1, startId + 2, startId + 3, startId + 4];
  const tiers: ContactTier[] = [1, 1, 2, 3, 4];

  const newUsers: SocialUser[] = ids.map((userId) => {
    const { name, handle } = generateSyncedProfile(query, userId);
    const [city, country] = pickDemoLocation(userId);
    return { userId, name, handle, city, country };
  });

  const newEdges: FollowEdge[] = [
    { userId: me, fellowId: ids[0], status: 0 },
    { userId: me, fellowId: ids[1], status: 0 },
    { userId: anchorContact?.fellowId ?? me, fellowId: ids[2], status: 0 },
    { userId: ids[3], fellowId: me, status: 0 },
    { userId: anchorFollower?.userId ?? me, fellowId: ids[4], status: 0 },
  ];

  await db.collection('users').insertMany(newUsers);
  await db.collection('follows').insertMany(newEdges);

  // Two of the new edges touch `me` directly (ids[0]/[1] as a new contact,
  // ids[3] as a new follower) - invalidate now rather than waiting out the
  // TTL, so the search this triggers immediately sees the new edges.
  invalidateMyNetwork(me);

  const synced: SyncedContact[] = newUsers.map((user, i) => ({ ...user, tier: tiers[i] }));
  const timingMs = Math.round((performance.now() - start) * 100) / 100;
  return { synced, timingMs };
}
