import { config } from 'dotenv';
import { join } from 'path';
import { MongoClient } from 'mongodb';

// Load environment variables
config({ path: join(__dirname, '../.env.local') });

async function analyzeGraph() {
  if (!process.env.MONGODB_URI) {
    throw new Error('Please provide MONGODB_URI in .env.local file');
  }

  const client = await MongoClient.connect(process.env.MONGODB_URI);
  const db = client.db("graph-db-demo");

  try {
    // 1. Print top 5 most influential members
    console.log('\n=== Top 5 Most Influential Members ===');
    const influentialMembers = await db.collection("members").aggregate([
      {
        $graphLookup: {
          from: "members",
          startWith: "$_id",
          connectFromField: "_id",
          connectToField: "referredBy",
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
          name: 1,
          membershipLevel: 1,
          networkSize: 1,
          networkValue: 1,
          influenceScore: { $multiply: ["$networkSize", "$networkValue"] }
        }
      },
      { $sort: { influenceScore: -1 } },
      { $limit: 5 }
    ]).toArray();

    influentialMembers.forEach((member, index) => {
      console.log(`\n${index + 1}. ${member.name} (${member.membershipLevel})`);
      console.log(`   Network Size: ${member.networkSize}`);
      console.log(`   Network Value: ${member.networkValue}`);
      console.log(`   Influence Score: ${member.influenceScore}`);
    });

    // 2. Analyze referral chain depths
    console.log('\n=== Referral Chain Analysis ===');
    const referralDepths = await db.collection("members").aggregate([
      {
        $graphLookup: {
          from: "members",
          startWith: "$_id",
          connectFromField: "_id",
          connectToField: "referredBy",
          as: "referralChain",
          maxDepth: 5,
          depthField: "depth"
        }
      },
      { $unwind: "$referralChain" },
      {
        $group: {
          _id: "$referralChain.depth",
          count: { $sum: 1 },
          membershipLevels: { $push: "$referralChain.membershipLevel" }
        }
      },
      { $sort: { _id: 1 } }
    ]).toArray();

    referralDepths.forEach(depth => {
      console.log(`\nDepth ${depth._id}:`);
      console.log(`Total members: ${depth.count}`);
      const levelCounts = depth.membershipLevels.reduce((acc: any, level: string) => {
        acc[level] = (acc[level] || 0) + 1;
        return acc;
      }, {});
      console.log('Membership distribution:', levelCounts);
    });

    // 3. Monthly growth analysis
    console.log('\n=== Monthly Referral Growth ===');
    const monthlyGrowth = await db.collection("members").aggregate([
      {
        $group: {
          _id: {
            year: { $year: "$joinDate" },
            month: { $month: "$joinDate" }
          },
          newMembers: { $sum: 1 },
          membershipLevels: { $push: "$membershipLevel" }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]).toArray();

    monthlyGrowth.forEach(month => {
      console.log(`\n${month._id.year}-${month._id.month.toString().padStart(2, '0')}`);
      console.log(`New members: ${month.newMembers}`);
      const levelCounts = month.membershipLevels.reduce((acc: any, level: string) => {
        acc[level] = (acc[level] || 0) + 1;
        return acc;
      }, {});
      console.log('Level distribution:', levelCounts);
    });

  } finally {
    await client.close();
  }
}

analyzeGraph().catch(console.error);
