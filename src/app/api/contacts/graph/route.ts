import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { CURRENT_USER_ID } from '@/lib/socialGraph';
import { FollowEdge, SocialUser } from '@/models/social';

export interface FullGraphResponse {
  me: number;
  nodes: SocialUser[];
  edges: FollowEdge[];
}

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db('graph-db-demo');

    const [nodes, edges] = await Promise.all([
      db.collection<SocialUser>('users').find({}, { projection: { _id: 0 } }).toArray(),
      db
        .collection<FollowEdge>('follows')
        .find({ status: { $ne: 3 } }, { projection: { _id: 0 } })
        .toArray(),
    ]);

    const response: FullGraphResponse = { me: CURRENT_USER_ID, nodes, edges };
    return NextResponse.json(response);
  } catch (error) {
    console.error('Full graph error:', error);
    return NextResponse.json({ error: 'Failed to load graph' }, { status: 500 });
  }
}
