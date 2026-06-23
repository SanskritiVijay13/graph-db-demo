import { Db } from 'mongodb';
import { faker } from '@faker-js/faker';
import { FollowEdge, SocialUser } from '@/models/social';
import { pickDemoLocation } from '@/lib/demoLocations';
import { SEARCH_INDEX_DEFINITION, SEARCH_INDEX_NAME } from '@/lib/socialGraph';
import { clearCache } from '@/lib/edgeCache';

// Mirrors the "User Search Logic Documentation" example: Nigam (6) follows
// Dev Sharma (99) and Ravi Kumar (100), has blocked Developer Girl (101),
// 99 & 100 follow Dev Chauhan (102) / Devika Mehta (103), and Dev Patel (104) /
// Sara Khan (105) follow Nigam back, themselves following 102/103/106.
// Devender Rao (107) and Devanshi Singh (109) are deliberately left
// unconnected to Nigam's graph even though their names match "dev" - they
// should NOT show up in recommendations, proving the demo combines search
// with graph reachability rather than keyword-matching alone.
const curatedUsers: SocialUser[] = [
  { userId: 6, name: 'Nigam Tiwari', handle: '@nigamkr', city: 'Delhi', country: 'India' },
  { userId: 99, name: 'Dev Sharma', handle: '@devsharma', city: 'Mumbai', country: 'India' },
  { userId: 100, name: 'Ravi Kumar', handle: '@ravi', city: 'Bangalore', country: 'India' },
  { userId: 101, name: 'Developer Girl', handle: '@codequeen', city: 'Pune', country: 'India' },
  { userId: 102, name: 'Dev Chauhan', handle: '@devc', city: 'Hyderabad', country: 'India' },
  { userId: 103, name: 'Devika Mehta', handle: '@devika', city: 'Chennai', country: 'India' },
  { userId: 104, name: 'Dev Patel', handle: '@devpatel', city: 'Ahmedabad', country: 'India' },
  { userId: 105, name: 'Sara Khan', handle: '@sarakhan', city: 'Kolkata', country: 'India' },
  { userId: 106, name: 'Alex Stone', handle: '@alexstone', city: 'Mumbai', country: 'India' },
  { userId: 107, name: 'Devender Rao', handle: '@devenderrao', city: 'Delhi', country: 'India' },
  { userId: 109, name: 'Devanshi Singh', handle: '@devanshi', city: 'Delhi', country: 'India' },
];

const curatedEdges: FollowEdge[] = [
  { userId: 6, fellowId: 99, status: 0 },
  { userId: 6, fellowId: 100, status: 0 },
  { userId: 6, fellowId: 101, status: 3 },

  { userId: 99, fellowId: 102, status: 0 },
  { userId: 99, fellowId: 103, status: 0 },
  { userId: 100, fellowId: 102, status: 0 },

  { userId: 104, fellowId: 6, status: 0 },
  { userId: 105, fellowId: 6, status: 0 },

  { userId: 104, fellowId: 102, status: 0 },
  { userId: 104, fellowId: 106, status: 0 },
  { userId: 105, fellowId: 102, status: 0 },
  { userId: 105, fellowId: 103, status: 0 },
];

const FILLER_USER_COUNT = 20;
const FILLER_EDGE_COUNT = 25;
const FILLER_ID_START = 1000;

function generateFillerUsers(): SocialUser[] {
  faker.seed(42);
  return Array.from({ length: FILLER_USER_COUNT }, (_, i) => {
    const [city, country] = pickDemoLocation(i);
    return {
      userId: FILLER_ID_START + i,
      name: faker.person.fullName(),
      handle: `@${faker.internet.username().toLowerCase().replace(/[^a-z0-9_]/g, '')}`,
      city,
      country,
    };
  });
}

// Filler users only follow other filler users - kept isolated from Nigam's
// curated graph so the demo's tiers stay predictable.
function generateFillerEdges(fillerUsers: SocialUser[]): FollowEdge[] {
  const ids = fillerUsers.map((u) => u.userId);
  const edges: FollowEdge[] = [];
  for (let i = 0; i < FILLER_EDGE_COUNT; i++) {
    const a = ids[Math.floor(Math.random() * ids.length)];
    const b = ids[Math.floor(Math.random() * ids.length)];
    if (a === b) continue;
    edges.push({ userId: a, fellowId: b, status: 0 });
  }
  return edges;
}

export async function ensureSearchIndex(db: Db, options: { maxWaitAttempts?: number } = {}): Promise<void> {
  const usersCollection = db.collection('users');
  const existingIndexes = await usersCollection
    .listSearchIndexes()
    .toArray()
    .catch(() => [] as Array<{ name?: string }>);

  if (!existingIndexes.some((idx) => idx.name === SEARCH_INDEX_NAME)) {
    await usersCollection.createSearchIndex(SEARCH_INDEX_DEFINITION);
  }

  const maxAttempts = options.maxWaitAttempts ?? 20;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const indexes = (await usersCollection.listSearchIndexes(SEARCH_INDEX_NAME).toArray()) as Array<{
      queryable?: boolean;
    }>;
    if (indexes[0]?.queryable) return;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}

// Wipes and reseeds the users/follows collections back to the pristine demo
// state. Shared by the CLI seed script and the "Reset Demo" button so both
// paths can never drift apart.
export async function resetSocialGraph(db: Db): Promise<{ userCount: number; edgeCount: number }> {
  const fillerUsers = generateFillerUsers();
  const fillerEdges = generateFillerEdges(fillerUsers);

  await db.collection('users').deleteMany({});
  await db.collection('follows').deleteMany({});

  const allUsers = [...curatedUsers, ...fillerUsers];
  const allEdges = [...curatedEdges, ...fillerEdges];

  await db.collection('users').insertMany(allUsers);
  await db.collection('follows').insertMany(allEdges);

  await db.collection('users').createIndex({ userId: 1 }, { unique: true, name: 'userId_unique' });
  await db.collection('follows').createIndexes([
    { key: { userId: 1, status: 1 }, name: 'userId_status' },
    { key: { fellowId: 1, status: 1 }, name: 'fellowId_status' },
  ]);

  // Every edge in the database just got replaced - a no-op when called from
  // the CLI seed script (no server process running to hold a cache), but
  // clears the live cache when called via the "Reset Demo" button so the
  // very next request can't see pre-reset edges for up to the TTL window.
  clearCache();

  return { userCount: allUsers.length, edgeCount: allEdges.length };
}
