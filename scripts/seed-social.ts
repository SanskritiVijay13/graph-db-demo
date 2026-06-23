import { config } from 'dotenv';
import { join } from 'path';
import { MongoClient } from 'mongodb';
import { ensureSearchIndex, resetSocialGraph } from '@/lib/seedSocialGraph';
import { SEARCH_INDEX_NAME } from '@/lib/socialGraph';

config({ path: join(__dirname, '../.env.local') });

const DB_NAME = 'graph-db-demo';

async function seed() {
  if (!process.env.MONGODB_URI) {
    throw new Error('Please provide MONGODB_URI in .env.local');
  }

  const client = await MongoClient.connect(process.env.MONGODB_URI);
  const db = client.db(DB_NAME);

  try {
    const { userCount, edgeCount } = await resetSocialGraph(db);
    console.log(`Inserted ${userCount} users and ${edgeCount} follow edges.`);

    console.log(`Ensuring Atlas Search index "${SEARCH_INDEX_NAME}" exists and is queryable...`);
    await ensureSearchIndex(db);
    console.log('Seed complete.');
  } finally {
    await client.close();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
