import { config } from 'dotenv';
import { join } from 'path';
import { MongoClient, ObjectId } from 'mongodb';
import { Member } from '@/models/types';

// Load environment variables from .env.local
config({ path: join(__dirname, '../.env.local') });

interface MemberSeed {
  _id: ObjectId;
  name: string;
  email: string;
  membershipLevel: 'SILVER' | 'GOLD' | 'PLATINUM';
  joinDate: Date;
  referredBy?: ObjectId;
  status: 'ACTIVE' | 'INACTIVE';
  location: {
    city: string;
    state: string;
    country: string;
  };
  influenceScore: number;
  totalReferrals: number;
  lastActive: Date;
  achievements: Array<{
    type: string;
    title: string;
    description: string;
    dateEarned: Date;
    icon: string;
  }>;
  upgradeHistory: Array<{
    from: 'SILVER' | 'GOLD';
    to: 'GOLD' | 'PLATINUM';
    date: Date;
  }>;
  referralSuccess: number;
}

// Create deterministic ObjectIds for consistent relationships
const createObjectId = (index: number) => {
  const hexString = index.toString(16).padStart(24, '0');
  return new ObjectId(hexString);
};

// Function to generate a date within a specific range
const getDateInRange = (start: Date, end: Date) => {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

// Function to calculate influence score based on various factors
const calculateInfluenceScore = (
  membershipLevel: string,
  totalReferrals: number,
  referralSuccess: number,
  daysActive: number
) => {
  const baseScore = membershipLevel === 'PLATINUM' ? 70 : membershipLevel === 'GOLD' ? 50 : 30;
  const referralScore = Math.min(20, totalReferrals * 2);
  const successScore = referralSuccess * 10;
  const activityScore = Math.min(10, daysActive / 30);

  return Math.round(baseScore + referralScore + successScore + activityScore);
};

// Function to generate sample members with realistic referral patterns
async function generateSampleData() {
  if (!process.env.MONGODB_URI) {
    throw new Error('Please provide MONGODB_URI in .env.local file');
  }

  const client = await MongoClient.connect(process.env.MONGODB_URI);
  const db = client.db("graph-db-demo");

  try {
    // Clear existing data
    await db.collection("members").deleteMany({});

    const cities = [
      { city: 'Mumbai', state: 'Maharashtra', country: 'India' },
      { city: 'Delhi', state: 'Delhi', country: 'India' },
      { city: 'Bangalore', state: 'Karnataka', country: 'India' },
      { city: 'Chennai', state: 'Tamil Nadu', country: 'India' },
      { city: 'Hyderabad', state: 'Telangana', country: 'India' },
      { city: 'Pune', state: 'Maharashtra', country: 'India' },
      { city: 'Kolkata', state: 'West Bengal', country: 'India' },
      { city: 'Ahmedabad', state: 'Gujarat', country: 'India' },
    ];

    // Define member seeds with specific patterns
    const memberSeeds: MemberSeed[] = [
      // Platinum members (early joiners, highly influential)
      {
        _id: createObjectId(1),
        name: "John Smith",
        email: "john.smith@example.com",
        membershipLevel: "PLATINUM",
        joinDate: new Date("2024-01-01"),
        status: "ACTIVE",
        location: cities[0],
        influenceScore: 95,
        totalReferrals: 15,
        lastActive: new Date(),
        achievements: [
          {
            type: "REFERRAL_MILESTONE",
            title: "Network Builder",
            description: "Successfully referred 15 new members",
            dateEarned: new Date("2024-02-15"),
            icon: "/images/achievements/network-builder.png"
          },
          {
            type: "MEMBERSHIP_MILESTONE",
            title: "Platinum Elite",
            description: "Achieved Platinum membership status",
            dateEarned: new Date("2024-01-15"),
            icon: "/images/achievements/platinum-elite.png"
          }
        ],
        upgradeHistory: [
          {
            from: "SILVER",
            to: "GOLD",
            date: new Date("2024-01-10")
          },
          {
            from: "GOLD",
            to: "PLATINUM",
            date: new Date("2024-01-15")
          }
        ],
        referralSuccess: 0.95
      },
      // Add 30 more members with varied characteristics
      ...Array.from({ length: 30 }, (_, i) => {
        const index = i + 2;
        const referralTier = Math.floor(Math.random() * 4); // 0-3 for different referral chain depths
        const referredBy = referralTier === 0 ? undefined : createObjectId(Math.floor(Math.random() * index));
        const joinDate = getDateInRange(new Date("2024-01-01"), new Date());
        const daysActive = Math.floor((new Date().getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24));
        const totalReferrals = Math.floor(Math.random() * 10);
        const referralSuccess = 0.5 + Math.random() * 0.5;
        const location = cities[Math.floor(Math.random() * cities.length)];

        let membershipLevel: 'SILVER' | 'GOLD' | 'PLATINUM';
        if (index <= 10) {
          membershipLevel = Math.random() > 0.5 ? 'PLATINUM' : 'GOLD';
        } else if (index <= 20) {
          membershipLevel = Math.random() > 0.7 ? 'GOLD' : 'SILVER';
        } else {
          membershipLevel = 'SILVER';
        }

        const upgradeHistory: { from: 'SILVER' | 'GOLD'; to: 'GOLD' | 'PLATINUM'; date: Date; }[] = [];
        if (membershipLevel === 'PLATINUM') {
          upgradeHistory.push(
            {
              from: 'SILVER' as const,
              to: 'GOLD' as const,
              date: new Date(joinDate.getTime() + 7 * 24 * 60 * 60 * 1000)
            },
            {
              from: 'GOLD' as const,
              to: 'PLATINUM' as const,
              date: new Date(joinDate.getTime() + 14 * 24 * 60 * 60 * 1000)
            }
          );
        } else if (membershipLevel === 'GOLD') {
          upgradeHistory.push({
            from: 'SILVER' as const,
            to: 'GOLD' as const,
            date: new Date(joinDate.getTime() + 7 * 24 * 60 * 60 * 1000)
          });
        }

        const achievements = [];
        if (totalReferrals >= 5) {
          achievements.push({
            type: 'REFERRAL_MILESTONE',
            title: '5 Referrals',
            description: 'Successfully referred 5 new members',
            dateEarned: new Date(joinDate.getTime() + 30 * 24 * 60 * 60 * 1000),
            icon: '/images/achievements/referral-5.png'
          });
        }
        if (membershipLevel !== 'SILVER') {
          achievements.push({
            type: 'MEMBERSHIP_MILESTONE',
            title: `${membershipLevel.charAt(0) + membershipLevel.slice(1).toLowerCase()} Status`,
            description: `Achieved ${membershipLevel.toLowerCase()} membership status`,
            dateEarned: new Date(joinDate.getTime() + 7 * 24 * 60 * 60 * 1000),
            icon: `/images/achievements/${membershipLevel.toLowerCase()}-status.png`
          });
        }

        const status: 'ACTIVE' | 'INACTIVE' = Math.random() > 0.1 ? 'ACTIVE' : 'INACTIVE';

        return {
          _id: createObjectId(index),
          name: `Member ${index}`,
          email: `member${index}@example.com`,
          membershipLevel,
          joinDate,
          referredBy,
          status,
          location,
          influenceScore: calculateInfluenceScore(membershipLevel, totalReferrals, referralSuccess, daysActive),
          totalReferrals,
          lastActive: new Date(Date.now() - Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000),
          achievements,
          upgradeHistory,
          referralSuccess
        };
      })
    ];

    // Insert members
    await db.collection("members").insertMany(memberSeeds);

    // Calculate and update network metrics
    const members = await db.collection("members").find().toArray();

    // Print statistics
    console.log('Sample data generated successfully!');
    console.log(`Total members created: ${members.length}`);

    // Print membership level distribution
    const membershipDistribution = await db.collection("members").aggregate([
      {
        $group: {
          _id: "$membershipLevel",
          count: { $sum: 1 }
        }
      }
    ]).toArray();

    console.log('\nMembership Distribution:');
    membershipDistribution.forEach(level => {
      console.log(`${level._id}: ${level.count} members`);
    });

    // Print referral chain statistics
    const referralChains = await db.collection("members").aggregate([
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
      {
        $project: {
          name: 1,
          chainLength: { $size: "$referralChain" }
        }
      },
      {
        $match: {
          chainLength: { $gt: 0 }
        }
      },
      {
        $group: {
          _id: null,
          avgChainLength: { $avg: "$chainLength" },
          maxChainLength: { $max: "$chainLength" },
          totalChains: { $sum: 1 }
        }
      }
    ]).toArray();

    if (referralChains.length > 0) {
      console.log('\nReferral Chain Statistics:');
      console.log(`Average Chain Length: ${referralChains[0].avgChainLength.toFixed(2)}`);
      console.log(`Max Chain Length: ${referralChains[0].maxChainLength}`);
      console.log(`Total Chains: ${referralChains[0].totalChains}`);
    }

  } finally {
    await client.close();
  }
}

// Run the script
generateSampleData().catch(console.error);
