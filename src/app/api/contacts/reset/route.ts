import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { resetSocialGraph } from '@/lib/seedSocialGraph';
import { ResetResponse } from '@/models/social';

export async function POST() {
  try {
    const client = await clientPromise;
    const db = client.db('graph-db-demo');

    const { userCount, edgeCount } = await resetSocialGraph(db);

    const response: ResetResponse = { userCount, edgeCount };
    return NextResponse.json(response);
  } catch (error) {
    console.error('Contact reset error:', error);
    return NextResponse.json({ error: 'Failed to reset demo data' }, { status: 500 });
  }
}
