import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db("graph-db-demo");

    // 1. Most influential members (based on referral network size and membership levels)
    const influentialMembers = await db.collection("members").aggregate([
      {
        $graphLookup: {
          from: "members",
          startWith: "$_id",
          connectFromField: "_id",
          connectToField: "referredBy._id",
          as: "referralNetwork",
          maxDepth: 5,
          depthField: "depth"
        }
      },
      {
        $addFields: {
          networkSize: { $size: "$referralNetwork" },
          networkValue: {
            $reduce: {
              input: "$referralNetwork",
              initialValue: 0,
              in: {
                $add: [
                  "$$value",
                  {
                    $switch: {
                      branches: [
                        { case: { $eq: ["$$this.membershipLevel", "PLATINUM"] }, then: 3 },
                        { case: { $eq: ["$$this.membershipLevel", "GOLD"] }, then: 2 },
                        { case: { $eq: ["$$this.membershipLevel", "SILVER"] }, then: 1 }
                      ],
                      default: 0
                    }
                  }
                ]
              }
            }
          }
        }
      },
      {
        $project: {
          _id: 1,
          name: 1,
          email: 1,
          membershipLevel: 1,
          networkSize: 1,
          networkValue: 1,
          influenceScore: { $multiply: ["$networkSize", "$networkValue"] }
        }
      },
      { $sort: { influenceScore: -1 } }
    ]).toArray();

    // 2. Membership level distribution in referral chains
    const membershipDistribution = await db.collection("members").aggregate([
      {
        $graphLookup: {
          from: "members",
          startWith: "$_id",
          connectFromField: "_id",
          connectToField: "referredBy._id",
          as: "referralChain",
          maxDepth: 5,
          depthField: "depth"
        }
      },
      { $unwind: "$referralChain" },
      {
        $group: {
          _id: {
            referrer: "$name",
            referrerLevel: "$membershipLevel",
            depth: "$referralChain.depth"
          },
          referralsByLevel: {
            $push: "$referralChain.membershipLevel"
          }
        }
      },
      {
        $group: {
          _id: "$_id.referrer",
          levelDistribution: {
            $push: {
              depth: "$_id.depth",
              levels: "$referralsByLevel"
            }
          }
        }
      }
    ]).toArray();

    // 3. Temporal analysis of referral patterns
    const temporalAnalysis = await db.collection("members").aggregate([
      {
        $graphLookup: {
          from: "members",
          startWith: "$_id",
          connectFromField: "_id",
          connectToField: "referredBy._id",
          as: "referrals",
          maxDepth: 5
        }
      },
      { $unwind: "$referrals" },
      {
        $group: {
          _id: {
            year: { $year: "$referrals.joinDate" },
            month: { $month: "$referrals.joinDate" }
          },
          totalReferrals: { $sum: 1 },
          membershipLevels: { $push: "$referrals.membershipLevel" }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]).toArray();

    return NextResponse.json({
      influentialMembers,
      membershipDistribution,
      temporalAnalysis
    });
  } catch (error) {
    console.error('Error in analytics:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
