'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { NetworkGraph } from '@/components/network/NetworkGraph';
import { MemberCard } from '@/components/members/MemberCard';
import { NetworkMetrics } from '@/components/analytics/NetworkMetrics';
import { useState, useEffect } from 'react';
import { Member, NetworkGraph as NetworkGraphType, NetworkMetrics as NetworkMetricsType, ReferralNode } from '@/models/types';

export default function DashboardPage() {
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [networkData, setNetworkData] = useState<NetworkGraphType | null>(null);
  const [networkMetrics, setNetworkMetrics] = useState<NetworkMetricsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchNetworkData() {
      try {
        const response = await fetch('/api/network');
        if (!response.ok) {
          throw new Error('Failed to fetch network data');
        }
        const data = await response.json();
        setNetworkData(data.networkGraph);
        setNetworkMetrics(data.networkMetrics);
      } catch (error) {
        console.error('Error fetching network data:', error);
        setError('Failed to load network data. Please try again later.');
      } finally {
        setLoading(false);
      }
    }

    fetchNetworkData();
  }, []);

  const handleNodeClick = async (node: ReferralNode) => {
    try {
      const response = await fetch(`/api/members/${node.memberId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch member details');
      }
      const memberData = await response.json();
      setSelectedMember(memberData);
    } catch (error) {
      console.error('Error fetching member details:', error);
      // Fallback to basic data if API fails
      const fallbackMember: Member = {
        name: node.name,
        email: 'unknown@example.com',
        membershipLevel: node.membershipLevel as 'PLATINUM' | 'GOLD' | 'SILVER',
        joinDate: new Date(),
        totalReferrals: 0,
        status: 'ACTIVE',
        location: {
          city: 'Unknown',
          state: 'Unknown',
          country: 'Unknown',
        },
        lastActive: new Date(),
        achievements: [],
        upgradeHistory: [],
        referralSuccess: 0,
        influenceScore: node.influenceScore,
      };
      setSelectedMember(fallbackMember);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md mx-auto">
          <h3 className="text-xl font-bold text-red-600 mb-2">Error</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full bg-mahindra-blue text-white rounded-lg py-2 hover:bg-opacity-90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full">
        <div className="flex-1 flex">
          {/* Main Content Area */}
          <div className="flex-1 p-6 flex flex-col space-y-6">
            {/* Network Visualization */}
            <div className="flex-1 bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-bold text-mahindra-blue mb-4">Network Visualization</h2>
              {networkData && (
                <NetworkGraph 
                  data={networkData} 
                  onNodeClick={handleNodeClick}
                />
              )}
            </div>

            {/* Network Metrics */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-bold text-mahindra-blue mb-4">Network Metrics</h2>
              {networkMetrics && <NetworkMetrics metrics={networkMetrics} />}
            </div>
          </div>

          {/* Member Details Sidebar - Hidden by default, shown when member selected */}
          <div 
            className={`w-96 border-l border-gray-200 transition-all duration-300 ease-in-out ${
              selectedMember ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
            {selectedMember && (
              <div className="h-full overflow-auto">
                <MemberCard member={selectedMember} />
              </div>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white"></div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md mx-auto">
              <h3 className="text-xl font-bold text-red-600 mb-2">Error</h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <button 
                onClick={() => window.location.reload()}
                className="w-full bg-mahindra-blue text-white rounded-lg py-2 hover:bg-opacity-90 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
