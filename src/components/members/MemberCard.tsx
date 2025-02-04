import { Member } from '@/models/types';
import { CalendarIcon, EnvelopeIcon, MapPinIcon, TrophyIcon, UserGroupIcon, UsersIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { InfoTooltip } from '../ui/InfoTooltip';

interface MemberCardProps {
  member: Member;
}

export function MemberCard({ member }: MemberCardProps) {
  const getMembershipColor = (level: string) => {
    switch (level) {
      case 'PLATINUM':
        return 'bg-amber-100 text-amber-700 border border-amber-200';
      case 'GOLD':
        return 'bg-yellow-100 text-yellow-700 border border-yellow-200';
      case 'SILVER':
        return 'bg-slate-100 text-slate-700 border border-slate-200';
      default:
        return 'bg-blue-100 text-blue-700 border border-blue-200';
    }
  };

  const formatDate = (date: Date) => {
    return format(new Date(date), 'MMM dd, yyyy');
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header Section */}
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">{member.name}</h2>
            <span className={`mt-2 inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${getMembershipColor(member.membershipLevel)}`}>
              {member.membershipLevel}
            </span>
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end text-sm font-medium text-slate-600">
              Influence Score
              <InfoTooltip
                className="ml-1"
                content={
                  <div>
                    <p className="font-medium mb-1">MongoDB Graph Processing</p>
                    <p>Calculated using graph algorithms on the referral network:</p>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      <li>PageRank for network influence</li>
                      <li>Betweenness centrality for connection strength</li>
                      <li>Referral chain depth and success rate</li>
                    </ul>
                  </div>
                }
              />
            </div>
            <div className="text-2xl font-bold text-blue-600">{member.influenceScore.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* Main Content - Scrollable */}
      <div className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          {/* Contact Information */}
          <div className="space-y-4">
            <div className="flex items-center text-slate-700">
              <EnvelopeIcon className="h-5 w-5 mr-2 text-slate-400" />
              <span>{member.email}</span>
            </div>
            <div className="flex items-center text-slate-700">
              <MapPinIcon className="h-5 w-5 mr-2 text-slate-400" />
              <span>{member.location.city}, {member.location.state}, {member.location.country}</span>
            </div>
            <div className="flex items-center text-slate-700">
              <CalendarIcon className="h-5 w-5 mr-2 text-slate-400" />
              <span>Joined {formatDate(member.joinDate)}</span>
            </div>
          </div>

          {/* Referral Chain */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
              <UsersIcon className="h-5 w-5 mr-2 text-blue-500" />
              Referral Chain
              <InfoTooltip
                className="ml-2"
                content={
                  <div>
                    <p className="font-medium mb-1">MongoDB Graph Traversal</p>
                    <p>Efficiently retrieves the entire referral chain using:</p>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      <li>$graphLookup for recursive traversal</li>
                      <li>$lookup for direct referrals</li>
                      <li>Indexed referredBy field for fast queries</li>
                    </ul>
                  </div>
                }
              />
            </h3>
            <div className="space-y-4">
              {/* Upline Chain */}
              {((member.referralChain?.length ?? 0) > 0 || member.referredBy) && (
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <div className="text-sm font-medium text-slate-600 mb-3 flex items-center">
                    <span>Referral Chain</span>
                    <InfoTooltip
                      className="ml-1"
                      content={
                        <div>
                          <p>Complete chain of referrals from newest to oldest</p>
                          <p className="text-xs text-slate-400 mt-1">Using MongoDB $graphLookup for efficient traversal</p>
                        </div>
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    {member.referredBy && (
                      <div className="flex items-center space-x-2">
                        <div className="flex-1 flex items-center justify-between p-2 bg-white rounded border border-slate-200">
                          <div>
                            <div className="font-semibold text-slate-800">{member.referredBy.name}</div>
                            <div className="text-xs text-slate-500">Direct Referrer</div>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getMembershipColor(member.referredBy.membershipLevel)}`}>
                            {member.referredBy.membershipLevel}
                          </span>
                        </div>
                      </div>
                    )}
                    {member.referralChain?.map((upline, index) => (
                      <div key={upline._id.toString()} className="flex items-center space-x-2">
                        <div className="w-8 flex justify-center">
                          <div className="h-full w-0.5 bg-slate-200"></div>
                        </div>
                        <div className="flex-1 flex items-center justify-between p-2 bg-white rounded border border-slate-200">
                          <div>
                            <div className="font-semibold text-slate-800">{upline.name}</div>
                            <div className="text-xs text-slate-500">Level {index + 1}</div>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getMembershipColor(upline.membershipLevel)}`}>
                            {upline.membershipLevel}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Direct Referrals */}
              {member.directReferrals && member.directReferrals.length > 0 && (
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <div className="flex items-center">
                    <div className="text-sm font-medium text-slate-600">Direct Referrals ({member.directReferrals.length})</div>
                    <InfoTooltip
                      className="ml-1"
                      content={
                        <div>
                          <p className="font-medium mb-1">MongoDB Indexing</p>
                          <p>Fast referral lookups using:</p>
                          <ul className="list-disc list-inside mt-1 space-y-1">
                            <li>Compound index on referredBy + status</li>
                            <li>Covered queries for basic info</li>
                            <li>Aggregation for detailed stats</li>
                          </ul>
                        </div>
                      }
                    />
                  </div>
                  <div className="space-y-2 mt-3">
                    {member.directReferrals.map((referral, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-white rounded border border-slate-200">
                        <div className="font-semibold text-slate-800">{referral.name}</div>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getMembershipColor(referral.membershipLevel)}`}>
                          {referral.membershipLevel}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div className="flex items-center">
                <div className="text-sm font-medium text-slate-600">Total Referrals</div>
                <InfoTooltip
                  className="ml-1"
                  content={
                    <div>
                      <p className="font-medium mb-1">MongoDB Aggregation</p>
                      <p>Efficient counting using:</p>
                      <ul className="list-disc list-inside mt-1">
                        <li>$count with indexed fields</li>
                        <li>Cached results for performance</li>
                      </ul>
                    </div>
                  }
                />
              </div>
              <div className="mt-1 flex items-baseline">
                <div className="text-2xl font-bold text-slate-800">{member.totalReferrals}</div>
                <div className="ml-2 text-sm text-slate-600">members</div>
              </div>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div className="flex items-center">
                <div className="text-sm font-medium text-slate-600">Referral Success</div>
                <InfoTooltip
                  className="ml-1"
                  content={
                    <div>
                      <p className="font-medium mb-1">MongoDB Pipeline</p>
                      <p>Real-time calculation using:</p>
                      <ul className="list-disc list-inside mt-1">
                        <li>$match on status field</li>
                        <li>$group for ratio calculation</li>
                        <li>Status-based indexing</li>
                      </ul>
                    </div>
                  }
                />
              </div>
              <div className="mt-1 flex items-baseline">
                <div className="text-2xl font-bold text-slate-800">{(member.referralSuccess * 100).toFixed(1)}%</div>
                <div className="ml-2 text-sm text-slate-600">conversion</div>
              </div>
            </div>
          </div>

          {/* Achievements */}
          {member.achievements && member.achievements.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
                <TrophyIcon className="h-5 w-5 mr-2 text-amber-500" />
                Achievements
                <InfoTooltip
                  className="ml-2"
                  content={
                    <div>
                      <p className="font-medium mb-1">MongoDB Time-Series</p>
                      <p>Achievement tracking using:</p>
                      <ul className="list-disc list-inside mt-1">
                        <li>Time-based indexing</li>
                        <li>Automatic cleanup of old records</li>
                        <li>Efficient date range queries</li>
                      </ul>
                    </div>
                  }
                />
              </h3>
              <div className="space-y-4">
                {member.achievements.map((achievement, index) => (
                  <div key={index} className="flex items-center p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="h-10 w-10 mr-4 text-amber-500">
                      <TrophyIcon className="h-full w-full" aria-hidden="true" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-800">{achievement.title}</div>
                      <div className="text-sm text-slate-600">{achievement.description}</div>
                      <div className="text-xs text-slate-500 mt-1">Earned on {formatDate(achievement.dateEarned)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Membership History */}
          {member.upgradeHistory && member.upgradeHistory.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
                <UserGroupIcon className="h-5 w-5 mr-2 text-blue-500" />
                Membership History
                <InfoTooltip
                  className="ml-2"
                  content={
                    <div>
                      <p className="font-medium mb-1">MongoDB Change Streams</p>
                      <p>Real-time tracking using:</p>
                      <ul className="list-disc list-inside mt-1">
                        <li>Change streams for updates</li>
                        <li>Automatic versioning</li>
                        <li>Point-in-time recovery</li>
                      </ul>
                    </div>
                  }
                />
              </h3>
              <div className="space-y-4">
                {member.upgradeHistory.map((upgrade, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="font-semibold text-slate-800">
                      {upgrade.fromLevel} → {upgrade.toLevel}
                    </div>
                    <div className="text-sm text-slate-500">{formatDate(upgrade.date)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Stats */}
      <div className="border-t border-slate-200 p-4">
        <div className="flex items-center text-sm text-slate-600">
          Last active: {formatDate(member.lastActive)}
          <InfoTooltip
            className="ml-1"
            content={
              <div>
                <p className="font-medium mb-1">MongoDB TTL Index</p>
                <p>Activity tracking using:</p>
                <ul className="list-disc list-inside mt-1">
                  <li>TTL index for auto-expiry</li>
                  <li>Atomic updates for activity</li>
                  <li>Background cleanup process</li>
                </ul>
              </div>
            }
          />
        </div>
      </div>
    </div>
  );
}
