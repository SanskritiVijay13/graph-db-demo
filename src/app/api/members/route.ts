import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { Member } from '@/models/types'

export async function GET() {
  if (!process.env.MONGODB_URI) {
    return NextResponse.json({ error: 'MongoDB URI not configured' }, { status: 500 })
  }

  try {
    const client = await clientPromise
    const db = client.db("graph-db-demo")
    const collection = db.collection("members")

    const members = await collection.find({}).toArray()

    const formattedMembers: Member[] = members.map(member => ({
      _id: member._id,
      name: member.name,
      email: member.email,
      membershipLevel: member.membershipLevel,
      joinDate: member.joinDate,
      referredBy: member.referredBy,
      totalReferrals: member.totalReferrals || 0,
      status: member.status || 'ACTIVE',
      location: {
        city: member.city || 'Unknown',
        state: member.state || 'Unknown',
        country: member.country || 'India'
      },
      profileImage: member.profileImage,
      achievements: member.achievements || [],
      lastActive: member.lastActive || new Date(),
      upgradeHistory: member.upgradeHistory || [],
      referralSuccess: member.referralSuccess || 0,
      influenceScore: member.influenceScore || 0
    }));

    await client.close();

    return NextResponse.json(formattedMembers)
  } catch (error) {
    console.error('Error fetching members:', error)
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const client = await clientPromise
    const db = client.db("graph-db-demo")
    const body = await request.json()

    const newMember: Member = {
      name: body.name,
      email: body.email,
      membershipLevel: body.membershipLevel,
      joinDate: new Date(),
      referredBy: body.referredBy,
      status: 'ACTIVE',
      totalReferrals: 0,
      location: {
        city: body.city || 'Unknown',
        state: body.state || 'Unknown',
        country: body.country || 'India'
      },
      profileImage: body.profileImage,
      achievements: body.achievements || [],
      lastActive: new Date(),
      upgradeHistory: [],
      referralSuccess: 0,
      influenceScore: 0
    }

    const result = await db.collection("members").insertOne(newMember)

    if (body.referredBy) {
      // Update referrer's total referrals
      await db.collection("members").updateOne(
        { _id: body.referredBy },
        { $inc: { totalReferrals: 1 } }
      )
    }

    return NextResponse.json({ member: { ...newMember, _id: result.insertedId } })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to create member' }, { status: 500 })
  }
}
