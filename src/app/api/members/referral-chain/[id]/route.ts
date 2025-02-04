import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const client = await clientPromise
    const db = client.db("graph-db-demo")

    // Using $graphLookup to traverse the referral chain
    const result = await db.collection("members").aggregate([
      {
        $match: { _id: new ObjectId(params.id) }
      },
      {
        $graphLookup: {
          from: "members",
          startWith: "$_id",
          connectFromField: "_id",
          connectToField: "referredBy._id",
          as: "referrals",
          depthField: "level",
          maxDepth: 5
        }
      },
      {
        $project: {
          _id: 1,
          name: 1,
          email: 1,
          membershipLevel: 1,
          referrals: {
            $map: {
              input: "$referrals",
              as: "referral",
              in: {
                _id: "$$referral._id",
                name: "$$referral.name",
                email: "$$referral.email",
                membershipLevel: "$$referral.membershipLevel",
                level: "$$referral.level"
              }
            }
          }
        }
      }
    ]).toArray()

    if (result.length === 0) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    return NextResponse.json(result[0])
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to fetch referral chain' }, { status: 500 })
  }
}
