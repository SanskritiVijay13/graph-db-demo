import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { syncNewContacts } from '@/lib/socialGraph';
import { ContactSyncResponse } from '@/models/social';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const query = typeof body.query === 'string' ? body.query : '';

    const client = await clientPromise;
    const db = client.db('graph-db-demo');

    const { synced, timingMs } = await syncNewContacts(db, query);

    const response: ContactSyncResponse = { synced, timingMs };
    return NextResponse.json(response);
  } catch (error) {
    console.error('Contact sync error:', error);
    return NextResponse.json({ error: 'Failed to sync contacts' }, { status: 500 });
  }
}
