import { config } from 'dotenv';
import { join } from 'path';
import { MongoClient, Db, Document } from 'mongodb';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { CURRENT_USER_ID, buildSearchPipeline, syncNewContacts } from '@/lib/socialGraph';
import { resetSocialGraph } from '@/lib/seedSocialGraph';

config({ path: join(__dirname, '../../.env.local') });

let client: MongoClient;
let db: Db;

beforeAll(async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI not set - this test runs against the real Atlas cluster in .env.local');
  }
  client = await MongoClient.connect(process.env.MONGODB_URI);
  db = client.db('graph-db-demo');
  // Reset to a known baseline so syncNewContacts' anchor lookups (an existing
  // contact/follower of CURRENT_USER_ID) are deterministic, regardless of
  // whatever state the live demo happened to be left in.
  await resetSocialGraph(db);
});

afterAll(async () => {
  await client.close();
});

// Atlas Search indexes new documents asynchronously, so polling (not a single
// query) is the only correct way to check "is this actually in the index" -
// see fetchResultsResilient in src/app/contacts/page.tsx for the same pattern.
async function waitUntilSearchable(query: string, ids: number[], maxAttempts = 15): Promise<boolean> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const results = await db.collection('users').aggregate(buildSearchPipeline(query)).toArray();
    const foundIds = new Set(results.map((r) => (r as Document).userId as number));
    if (ids.every((id) => foundIds.has(id))) return true;
    await new Promise((resolve) => setTimeout(resolve, 600));
  }
  return false;
}

describe('syncNewContacts', () => {
  it('persists 5 new users + follow edges to MongoDB, and they become searchable via Atlas Search', async () => {
    const { synced, timingMs } = await syncNewContacts(db, 'dev');
    const syncedIds = synced.map((s) => s.userId);

    try {
      expect(synced).toHaveLength(5);
      expect(synced.map((s) => s.tier)).toEqual([1, 1, 2, 3, 4]);
      expect(timingMs).toBeGreaterThan(0);

      // 1. The insertMany into `users` actually landed - read it back from
      // the database rather than trusting the function's return value alone.
      const userDocs = await db
        .collection('users')
        .find({ userId: { $in: syncedIds } })
        .toArray();
      expect(userDocs).toHaveLength(5);
      for (const expected of synced) {
        const doc = userDocs.find((u) => u.userId === expected.userId);
        expect(doc).toBeDefined();
        expect(doc?.name).toBe(expected.name);
        expect(doc?.handle).toBe(expected.handle);
      }

      // 2. The insertMany into `follows` actually landed - exactly one new
      // edge per synced user, attached at the tier the function intended.
      const edgeDocs = await db
        .collection('follows')
        .find({ $or: [{ userId: { $in: syncedIds } }, { fellowId: { $in: syncedIds } }] })
        .toArray();
      expect(edgeDocs).toHaveLength(5);

      const tier1Ids = synced.filter((s) => s.tier === 1).map((s) => s.userId);
      for (const id of tier1Ids) {
        expect(edgeDocs.some((e) => e.userId === CURRENT_USER_ID && e.fellowId === id && e.status === 0)).toBe(true);
      }

      const tier2Id = synced.find((s) => s.tier === 2)?.userId;
      expect(edgeDocs.some((e) => e.fellowId === tier2Id)).toBe(true);

      const tier3Id = synced.find((s) => s.tier === 3)?.userId;
      expect(edgeDocs.some((e) => e.userId === tier3Id && e.fellowId === CURRENT_USER_ID)).toBe(true);

      const tier4Id = synced.find((s) => s.tier === 4)?.userId;
      expect(edgeDocs.some((e) => e.fellowId === tier4Id)).toBe(true);

      // 3. The Atlas Search index actually picked up the new documents, not
      // just the raw collection - this is the part that's easy to assume
      // works and silently doesn't (see the eventual-consistency bug fixed
      // earlier in this project).
      const isSearchable = await waitUntilSearchable('dev', syncedIds);
      expect(isSearchable).toBe(true);
    } finally {
      // Don't leave synthetic test data sitting in the demo dataset.
      await db.collection('users').deleteMany({ userId: { $in: syncedIds } });
      await db
        .collection('follows')
        .deleteMany({ $or: [{ userId: { $in: syncedIds } }, { fellowId: { $in: syncedIds } }] });
    }
  });
});
