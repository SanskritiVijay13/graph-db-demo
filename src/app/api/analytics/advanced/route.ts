import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { NetworkMetrics, NetworkGraph, ReferralNode, ReferralLink, Member, UpgradeCandidate } from '@/models/types';
import { ObjectId } from 'mongodb';

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db("graph-db-demo");

    // 1. Calculate Network Metrics
    const networkMetrics = await db.collection("members").aggregate([
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
        $lookup: {
          from: "members",
          localField: "_id",
          foreignField: "referredBy._id",
          as: "directReferrals"
        }
      },
      {
        $addFields: {
          // Calculate influence score
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
          },
          // Calculate betweenness centrality (simplified)
          betweennessCentrality: {
            $divide: [
              { $size: "$referralNetwork" },
              { $add: [1, { $size: "$directReferrals" }] }
            ]
          },
          // Calculate closeness centrality (simplified)
          closenessCentrality: {
            $divide: [
              1,
              {
                $add: [
                  1,
                  {
                    $avg: "$referralNetwork.depth"
                  }
                ]
              }
            ]
          },
          // Calculate referral velocity
          referralVelocity: {
            $let: {
              vars: {
                sortedReferrals: { $sortArray: { input: "$directReferrals", sortBy: { joinDate: 1 } } }
              },
              in: {
                $cond: {
                  if: { $gt: [{ $size: "$directReferrals" }, 1] },
                  then: {
                    $divide: [
                      {
                        $subtract: [
                          { $last: "$$sortedReferrals.joinDate" },
                          { $first: "$$sortedReferrals.joinDate" }
                        ]
                      },
                      { $multiply: [{ $size: "$directReferrals" }, 86400000] } // Convert to days
                    ]
                  },
                  else: 0
                }
              }
            }
          },
          // Calculate conversion rate
          conversionRate: {
            $cond: {
              if: { $gt: [{ $size: "$directReferrals" }, 0] },
              then: {
                $multiply: [
                  {
                    $divide: [
                      {
                        $size: {
                          $filter: {
                            input: "$directReferrals",
                            as: "ref",
                            cond: {
                              $in: ["$$ref.membershipLevel", ["GOLD", "PLATINUM"]]
                            }
                          }
                        }
                      },
                      { $size: "$directReferrals" }
                    ]
                  },
                  100
                ]
              },
              else: 0
            }
          },
          networkGrowthRate: 15.2, // Placeholder - implement actual calculation
          activeChains: 5, // Placeholder - implement actual calculation
          inactiveChains: 2, // Placeholder - implement actual calculation
          averageChainDepth: 3.5, // Placeholder - implement actual calculation
          geographicSpread: { cities: 45, states: 12, countries: 1 }, // Placeholder - implement actual calculation
          membershipDistribution: {
            platinum: { $size: { $filter: { input: "$referralNetwork", as: "ref", cond: { $eq: ["$$ref.membershipLevel", "PLATINUM"] } } } },
            gold: { $size: { $filter: { input: "$referralNetwork", as: "ref", cond: { $eq: ["$$ref.membershipLevel", "GOLD"] } } } },
            silver: { $size: { $filter: { input: "$referralNetwork", as: "ref", cond: { $eq: ["$$ref.membershipLevel", "SILVER"] } } } }
          }
        }
      },
      {
        $project: {
          memberId: "$_id",
          name: 1,
          membershipLevel: 1,
          influenceScore: { $multiply: ["$networkSize", "$networkValue"] },
          betweennessCentrality: 1,
          closenessCentrality: 1,
          referralVelocity: 1,
          conversionRate: 1,
          networkGrowthRate: 1,
          activeChains: 1,
          inactiveChains: 1,
          averageChainDepth: 1,
          geographicSpread: 1,
          membershipDistribution: 1
        }
      }
    ]).toArray() as NetworkMetrics[];

    // 2. Generate Network Graph for Visualization
    const members = await db.collection("members").find().toArray();

    const nodes: ReferralNode[] = members.map(member => ({
      id: member._id.toString(),
      memberId: member._id,
      name: member.name,
      membershipLevel: member.membershipLevel,
      influenceScore: member.influenceScore || 0,
      radius: getRadiusByLevel(member.membershipLevel),
    }));

    const links = members
      .filter(member => member.referredBy)
      .map(member => ({
        source: member.referredBy!._id.toString(),
        target: member._id.toString(),
        value: 1
      }));

    const networkGraph: NetworkGraph = {
      nodes,
      links,
      metrics: {
        totalMembers: members.length,
        activeMembers: members.filter(m => m.status === 'ACTIVE').length,
        averageChainLength: 4.2, // Placeholder - implement actual calculation
        networkDensity: 0.65, // Placeholder - implement actual calculation
        growthRate: 12.5 // Placeholder - implement actual calculation
      }
    };

    // 3. Identify Upgrade Candidates
    const upgradeCandidates = await db.collection("members").aggregate([
      {
        $match: {
          membershipLevel: { $in: ["SILVER", "GOLD"] }
        }
      },
      {
        $lookup: {
          from: "members",
          localField: "_id",
          foreignField: "referredBy._id",
          as: "referrals"
        }
      },
      {
        $addFields: {
          activeReferrals: {
            $size: {
              $filter: {
                input: "$referrals",
                as: "ref",
                cond: { $eq: ["$$ref.status", "ACTIVE"] }
              }
            }
          },
          upgradeScore: {
            $add: [
              { $size: "$referrals" },
              {
                $size: {
                  $filter: {
                    input: "$referrals",
                    as: "ref",
                    cond: { $in: ["$$ref.membershipLevel", ["GOLD", "PLATINUM"]] }
                  }
                }
              }
            ]
          }
        }
      },
      {
        $match: {
          activeReferrals: { $gte: 2 },
          upgradeScore: { $gte: 3 }
        }
      },
      {
        $project: {
          _id: 1,
          name: 1,
          membershipLevel: 1,
          activeReferrals: 1,
          upgradeScore: 1
        }
      },
      {
        $sort: { upgradeScore: -1 }
      }
    ]).toArray();

    return NextResponse.json({
      networkMetrics,
      networkGraph,
      upgradeCandidates
    });
  } catch (error) {
    console.error('Error in advanced analytics:', error);
    return NextResponse.json({ error: 'Failed to fetch advanced analytics' }, { status: 500 });
  }
}

function getRadiusByLevel(level: string): number {
  switch (level) {
    case 'PLATINUM':
      return 1;
    case 'GOLD':
      return 0.8;
    case 'SILVER':
      return 0.6;
    default:
      return 0.5;
  }
}
