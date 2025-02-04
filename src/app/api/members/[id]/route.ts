import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const client = await clientPromise;
    const db = client.db('graph-db-demo');
    const paramsId = (await params).id;

    // Get the member and populate referredBy details
    const member = await db.collection('members').aggregate([
      { 
        $match: { 
          _id: new ObjectId(paramsId) 
        } 
      },
      {
        $lookup: {
          from: 'members',
          localField: 'referredBy._id',
          foreignField: '_id',
          as: 'referredByDetails'
        }
      },
      {
        $lookup: {
          from: 'members',
          localField: '_id',
          foreignField: 'referredBy._id',
          as: 'directReferrals'
        }
      },
      {
        $graphLookup: {
          from: 'members',
          startWith: '$referredBy._id',
          connectFromField: 'referredBy._id',
          connectToField: '_id',
          as: 'referralChain',
          maxDepth: 10,
          depthField: 'level'
        }
      },
      {
        $unwind: {
          path: '$referredByDetails',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $addFields: {
          referralChain: {
            $sortArray: {
              input: '$referralChain',
              sortBy: { level: -1 }
            }
          }
        }
      },
      {
        $addFields: {
          referredBy: {
            $cond: {
              if: '$referredByDetails',
              then: {
                _id: '$referredByDetails._id',
                name: '$referredByDetails.name',
                membershipLevel: '$referredByDetails.membershipLevel'
              },
              else: null
            }
          }
        }
      }
    ]).next();

    if (!member) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    // Get referral success rate
    const referrals = await db.collection('members').countDocuments({
      referredBy: member._id
    });

    const activeReferrals = await db.collection('members').countDocuments({
      referredBy: member._id,
      status: 'ACTIVE'
    });

    const referralSuccess = referrals > 0 ? activeReferrals / referrals : 0;

    // Get upgrade history
    const upgradeHistory = await db.collection('membershipChanges')
      .find({ memberId: member._id })
      .sort({ date: -1 })
      .toArray();

    // Get achievements
    const achievements = await db.collection('achievements')
      .find({ memberId: member._id })
      .sort({ dateEarned: -1 })
      .toArray();

    return NextResponse.json({
      ...member,
      referralSuccess,
      directReferrals: member.directReferrals,
      referralChain: member.referralChain,
      upgradeHistory,
      achievements
    });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch member details' },
      { status: 500 }
    );
  }
}
