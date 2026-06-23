import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { CURRENT_USER_ID, SEARCH_INDEX_DEFINITION, getSampleDocs, searchAndRankContacts } from '@/lib/socialGraph';
import { ContactSearchResponse } from '@/models/social';

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get('q')?.trim() ?? '';

    const client = await clientPromise;
    const db = client.db('graph-db-demo');

    const me = await db.collection('users').findOne({ userId: CURRENT_USER_ID });
    if (!me) {
      return NextResponse.json({ error: 'Demo data not seeded yet. Run `npm run seed:social`.' }, { status: 503 });
    }

    const sampleDocs = await getSampleDocs(db);

    if (!query) {
      const response: ContactSearchResponse = {
        query,
        me: { userId: me.userId, name: me.name, handle: me.handle, city: me.city, country: me.country },
        results: [],
        graph: { nodes: [{ userId: me.userId, tier: 0 }], edges: [] },
        pipelines: { search: [], graph: [] },
        searchIndexDefinition: SEARCH_INDEX_DEFINITION,
        sampleDocs,
        timings: { search: 0, graph: 0, myNetwork: 0, myNetworkCacheHit: false, total: 0 },
      };
      return NextResponse.json(response);
    }

    const { results, graph, pipelines, timings } = await searchAndRankContacts(db, query);

    const response: ContactSearchResponse = {
      query,
      me: { userId: me.userId, name: me.name, handle: me.handle, city: me.city, country: me.country },
      results,
      graph,
      pipelines,
      searchIndexDefinition: SEARCH_INDEX_DEFINITION,
      sampleDocs,
      timings,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Contact search error:', error);
    return NextResponse.json({ error: 'Failed to search contacts' }, { status: 500 });
  }
}
