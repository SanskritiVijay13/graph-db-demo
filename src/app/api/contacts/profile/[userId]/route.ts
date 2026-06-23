import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getContactProfile } from '@/lib/socialGraph';
import { ContactProfileResponse } from '@/models/social';

export async function GET(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const { userId: userIdParam } = await params;
    const userId = Number(userIdParam);
    if (!Number.isInteger(userId)) {
      return NextResponse.json({ error: 'Invalid userId' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('graph-db-demo');

    const profile = await getContactProfile(db, userId);
    if (!profile) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    const response: ContactProfileResponse = profile;
    return NextResponse.json(response);
  } catch (error) {
    console.error('Contact profile error:', error);
    return NextResponse.json({ error: 'Failed to load contact profile' }, { status: 500 });
  }
}
