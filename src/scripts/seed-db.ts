import { MongoClient, ObjectId } from 'mongodb';
import { faker } from '@faker-js/faker';
import { Member } from '@/models/types';
import { TrophyIcon } from '@heroicons/react/24/outline';

const uri = process.env.MONGODB_URI || '';
const client = new MongoClient(uri);

type CountryData = {
  [key in 'USA' | 'Canada' | 'UK' | 'Australia' | 'India' | 'Singapore' | 'Germany' | 'France']: string[];
};

const membershipLevels = ['SILVER', 'GOLD', 'PLATINUM'] as const;
type MembershipLevel = typeof membershipLevels[number];

async function seedDatabase() {
  try {
    await client.connect();
    const db = client.db('graph-db-demo');
    const membersCollection = db.collection<Member>('members');

    // Clear existing data
    await membersCollection.deleteMany({});

    const cities: CountryData = {
      'USA': ['New York', 'San Francisco', 'Chicago', 'Los Angeles', 'Boston'],
      'Canada': ['Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Ottawa'],
      'UK': ['London', 'Manchester', 'Birmingham', 'Edinburgh', 'Glasgow'],
      'Australia': ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide'],
      'India': ['Mumbai', 'Bangalore', 'Delhi', 'Pune', 'Hyderabad'],
      'Singapore': ['Singapore Central', 'Woodlands', 'Tampines', 'Jurong', 'Punggol'],
      'Germany': ['Berlin', 'Munich', 'Hamburg', 'Frankfurt', 'Cologne'],
      'France': ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nice']
    };

    const states: CountryData = {
      'USA': ['NY', 'CA', 'IL', 'TX', 'MA'],
      'Canada': ['ON', 'BC', 'QC', 'AB', 'NS'],
      'UK': ['England', 'Scotland', 'Wales', 'Northern Ireland'],
      'Australia': ['NSW', 'VIC', 'QLD', 'WA', 'SA'],
      'India': ['Maharashtra', 'Karnataka', 'Delhi', 'Tamil Nadu', 'Telangana'],
      'Singapore': ['Central Region', 'East Region', 'North Region', 'North-East Region', 'West Region'],
      'Germany': ['Berlin', 'Bavaria', 'Hamburg', 'Hesse', 'North Rhine-Westphalia'],
      'France': ['Île-de-France', 'Auvergne-Rhône-Alpes', 'Provence-Alpes-Côte d\'Azur', 'Occitanie', 'Hauts-de-France']
    };

    // Create 100 members
    const members: Member[] = [];
    const numMembers = 100;

    // Create founding members (no referrals)
    const numFounders = 5;
    for (let i = 0; i < numFounders; i++) {
      const country = faker.helpers.arrayElement(Object.keys(cities)) as keyof CountryData;
      const member: Member = {
        _id: new ObjectId(),
        name: faker.person.fullName(),
        email: faker.internet.email(),
        membershipLevel: 'PLATINUM',
        joinDate: faker.date.past({ years: 3 }),
        totalReferrals: 0,
        referralSuccess: faker.number.float({ min: 0.6, max: 0.9 }),
        status: 'ACTIVE',
        location: {
          city: faker.helpers.arrayElement(cities[country]),
          state: faker.helpers.arrayElement(states[country]),
          country: country
        },
        lastActive: faker.date.recent(),
        influenceScore: faker.number.float({ min: 8, max: 10 }),
        achievements: generateAchievements()
      };
      members.push(member);
    }

    // Create members with referrals
    for (let i = numFounders; i < numMembers; i++) {
      const country = faker.helpers.arrayElement(Object.keys(cities)) as keyof CountryData;
      const joinDate = faker.date.past({ years: 2 });

      // Determine membership level based on join date and random factor
      let membershipLevel: MembershipLevel;
      const timeInNetwork = Date.now() - joinDate.getTime();
      const monthsInNetwork = timeInNetwork / (1000 * 60 * 60 * 24 * 30);
      const random = Math.random();

      if (monthsInNetwork > 12 && random > 0.7) {
        membershipLevel = 'PLATINUM';
      } else if (monthsInNetwork > 6 && random > 0.4) {
        membershipLevel = 'GOLD';
      } else {
        membershipLevel = 'SILVER';
      }

      // Create interesting referral patterns
      let referredBy: Member | undefined;
      if (i < 20) {
        // First wave: referred by founders
        referredBy = faker.helpers.arrayElement(members.slice(0, numFounders));
      } else if (i < 50) {
        // Second wave: mix of founders and first wave
        referredBy = faker.helpers.arrayElement(members.slice(0, 20));
      } else {
        // Third wave: referred by anyone
        referredBy = faker.helpers.arrayElement(members);
      }

      const member: Member = {
        _id: new ObjectId(),
        name: faker.person.fullName(),
        email: faker.internet.email(),
        membershipLevel,
        joinDate,
        referredBy: referredBy ? {
          _id: referredBy._id!,
          name: referredBy.name,
          membershipLevel: referredBy.membershipLevel
        } : undefined,
        totalReferrals: 0,
        referralSuccess: faker.number.float({ min: 0.3, max: 0.9 }),
        status: faker.helpers.arrayElement(['ACTIVE', 'ACTIVE', 'ACTIVE', 'INACTIVE'] as const), // 75% active rate
        location: {
          city: faker.helpers.arrayElement(cities[country]),
          state: faker.helpers.arrayElement(states[country]),
          country: country
        },
        lastActive: faker.date.recent(),
        influenceScore: calculateInfluenceScore(membershipLevel, timeInNetwork),
        achievements: generateAchievements(),
        upgradeHistory: generateUpgradeHistory(membershipLevel, joinDate)
      };
      members.push(member);
    }

    // Update totalReferrals count for each member
    members.forEach(member => {
      member.totalReferrals = members.filter(m =>
        m.referredBy && m.referredBy._id.toString() === member._id!.toString()
      ).length;
    });

    // Insert all members
    await membersCollection.insertMany(members);
    console.log('Database seeded successfully with 100 members!');
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await client.close();
  }
}

function generateAchievements() {
  const numAchievements = faker.number.int({ min: 0, max: 5 });
  const achievements: Array<{
    title: string;
    description: string;
    icon: typeof TrophyIcon;
    dateEarned: Date;
  }> = [];

  const possibleAchievements = [
    {
      title: 'Network Pioneer',
      description: 'One of the first 100 members to join the network',
      icon: TrophyIcon
    },
    {
      title: 'Referral Champion',
      description: 'Successfully referred 10+ active members',
      icon: TrophyIcon
    },
    {
      title: 'Platinum Elite',
      description: 'Maintained Platinum status for 6+ months',
      icon: TrophyIcon
    },
    {
      title: 'Global Connector',
      description: 'Connected members across 3+ countries',
      icon: TrophyIcon
    },
    {
      title: 'Growth Catalyst',
      description: '90% success rate in referrals',
      icon: TrophyIcon
    },
    {
      title: 'Community Builder',
      description: 'Created a network branch 5 levels deep',
      icon: TrophyIcon
    },
    {
      title: 'Influence Leader',
      description: 'Top 10% influence score in the network',
      icon: TrophyIcon
    }
  ];

  for (let i = 0; i < numAchievements; i++) {
    const achievement = faker.helpers.arrayElement(possibleAchievements);
    if (!achievements.find(a => a.title === achievement.title)) {
      achievements.push({
        ...achievement,
        dateEarned: faker.date.past({ years: 1 })
      });
    }
  }

  return achievements;
}

function generateUpgradeHistory(currentLevel: MembershipLevel, joinDate: Date) {
  const history: Array<{
    fromLevel: MembershipLevel;
    toLevel: MembershipLevel;
    date: Date;
  }> = [];

  if (currentLevel === 'SILVER') {
    return [];
  }

  // Always start with SILVER
  let lastDate = joinDate;
  history.push({
    fromLevel: 'SILVER',
    toLevel: 'GOLD',
    date: new Date(lastDate.getTime() + faker.number.int({ min: 2, max: 6 }) * 30 * 24 * 60 * 60 * 1000) // 2-6 months after join
  });

  if (currentLevel === 'PLATINUM') {
    lastDate = history[0].date;
    history.push({
      fromLevel: 'GOLD',
      toLevel: 'PLATINUM',
      date: new Date(lastDate.getTime() + faker.number.int({ min: 3, max: 8 }) * 30 * 24 * 60 * 60 * 1000) // 3-8 months after GOLD
    });
  }

  return history;
}

function calculateInfluenceScore(membershipLevel: MembershipLevel, timeInNetwork: number) {
  const baseScore = {
    'PLATINUM': faker.number.float({ min: 7, max: 10 }),
    'GOLD': faker.number.float({ min: 5, max: 8 }),
    'SILVER': faker.number.float({ min: 3, max: 6 })
  }[membershipLevel];

  const timeBonus = Math.min(2, timeInNetwork / (1000 * 60 * 60 * 24 * 365) * 0.5); // Up to 2 points for each year
  return Math.min(10, baseScore + timeBonus);
}

seedDatabase().catch(console.error);
