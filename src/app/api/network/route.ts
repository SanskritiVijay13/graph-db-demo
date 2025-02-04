import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { NetworkGraph, NetworkMetrics, ReferralNode, ReferralLink, Member } from '@/models/types';
import { Document, ObjectId } from 'mongodb';

interface MemberDocument extends Document {
  _id: ObjectId;
  name: string;
  membershipLevel: 'PLATINUM' | 'GOLD' | 'SILVER';
  influenceScore: number;
  status: 'ACTIVE' | 'INACTIVE';
  joinDate: Date;
  referredBy?: { _id: ObjectId };
  location: {
    city: string;
    state: string;
    country: string;
  };
}

export async function GET(request: NextRequest) {
  try {
    console.log('Starting network data fetch...');
    const client = await clientPromise;
    console.log('MongoDB client connected');

    const db = client.db('graph-db-demo');
    console.log('Using database:', db.databaseName);

    // Get all members
    const members = await db.collection('members').find({}).toArray() as MemberDocument[];
    console.log('Found members:', members.length);

    // Calculate network metrics
    const totalMembers = members.length;
    const activeMembers = members.filter(m => m.status === 'ACTIVE').length;
    console.log('Active members:', activeMembers);

    // Create nodes and links
    const nodes: ReferralNode[] = members.map(member => ({
      id: member._id.toString(),
      memberId: member._id,
      name: member.name,
      membershipLevel: member.membershipLevel,
      influenceScore: member.influenceScore,
      radius: getRadiusByLevel(member.membershipLevel),
    }));
    console.log('Created nodes:', nodes.length);

    const referralLinks = await db.collection('members')
      .aggregate([
        {
          $match: {
            'referredBy._id': { $exists: true }
          }
        },
        {
          $project: {
            source: {
              $convert: {
                input: '$referredBy._id',
                to: 'string',
                onError: null
              }
            },
            target: {
              $convert: {
                input: '$_id',
                to: 'string',
                onError: null
              }
            },
            value: { $literal: 1 }
          }
        },
        {
          $match: {
            source: { $ne: null },
            target: { $ne: null }
          }
        }
      ]).toArray();
    console.log('Found referral links:', referralLinks.length);

    const links: ReferralLink[] = referralLinks.map(link => ({
      source: link.source,
      target: link.target,
      value: link.value
    }));

    // Calculate network metrics
    const membershipDistribution = {
      platinum: members.filter(m => m.membershipLevel === 'PLATINUM').length,
      gold: members.filter(m => m.membershipLevel === 'GOLD').length,
      silver: members.filter(m => m.membershipLevel === 'SILVER').length,
    };

    // Calculate referral chains
    const referralChains = await db.collection('members').aggregate([
      {
        $graphLookup: {
          from: 'members',
          startWith: '$_id',
          connectFromField: '_id',
          connectToField: 'referredBy._id',
          as: 'chain',
          maxDepth: 10
        }
      }
    ]).toArray() as Array<{ chain: MemberDocument[] }>;

    const chainLengths = referralChains.map(rc => rc.chain.length);
    const averageChainLength = chainLengths.length > 0
      ? chainLengths.reduce((a, b) => a + b, 0) / chainLengths.length
      : 0;

    // Calculate network density
    const possibleConnections = totalMembers * (totalMembers - 1);
    const actualConnections = links.length;
    const networkDensity = possibleConnections > 0 ? actualConnections / possibleConnections : 0;

    // Get geographic spread
    const locations = members.reduce((acc, member) => {
      acc.cities.add(member.location.city);
      acc.states.add(member.location.state);
      acc.countries.add(member.location.country);
      return acc;
    }, { cities: new Set<string>(), states: new Set<string>(), countries: new Set<string>() });

    // Calculate active and inactive chains
    const activeChains = referralChains.filter(rc =>
      rc.chain.every(m => m.status === 'ACTIVE')
    ).length;

    const inactiveChains = referralChains.length - activeChains;

    // Calculate network metrics
    const networkMetrics: NetworkMetrics = {
      memberId: members[0]?._id || null,
      name: 'Network Overview',
      membershipLevel: 'ALL',
      influenceScore: calculateAverageInfluence(members),
      betweennessCentrality: 0.45, // Would need graph theory calculations for exact value
      closenessCentrality: 0.68, // Would need graph theory calculations for exact value
      referralVelocity: calculateReferralVelocity(members),
      conversionRate: calculateConversionRate(members),
      networkGrowthRate: calculateGrowthRate(members),
      activeChains,
      inactiveChains,
      averageChainDepth: averageChainLength,
      geographicSpread: {
        cities: locations.cities.size,
        states: locations.states.size,
        countries: locations.countries.size,
      },
      membershipDistribution,
    };

    const networkGraph: NetworkGraph = {
      nodes,
      links,
      metrics: {
        totalMembers,
        activeMembers,
        averageChainLength,
        networkDensity,
        growthRate: networkMetrics.networkGrowthRate,
      },
    };

    return NextResponse.json({
      networkGraph,
      networkMetrics,
    });
  } catch (error) {
    console.error('Error fetching network data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
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

function calculateAverageInfluence(members: MemberDocument[]): number {
  return members.length > 0
    ? members.reduce((sum, m) => sum + (m.influenceScore || 0), 0) / members.length
    : 0;
}

function calculateReferralVelocity(members: MemberDocument[]): number {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentMembers = members.filter(m => new Date(m.joinDate) >= thirtyDaysAgo);
  return recentMembers.length;
}

function calculateConversionRate(members: MemberDocument[]): number {
  const referrals = members.filter(m => m.referredBy).length;
  return members.length > 0 ? referrals / members.length : 0;
}

function calculateGrowthRate(members: MemberDocument[]): number {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentMembers = members.filter(m => new Date(m.joinDate) >= thirtyDaysAgo).length;
  const totalMembers = members.length;

  return totalMembers > 0 ? (recentMembers / totalMembers) * 100 : 0;
}
