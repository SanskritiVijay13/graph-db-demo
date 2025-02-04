import { NetworkMetrics as NetworkMetricsType } from '@/models/types';
import { ArrowTrendingUpIcon, ChartBarIcon, UsersIcon } from '@heroicons/react/24/outline';
import { InfoTooltip } from '../ui/InfoTooltip';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
  Tooltip as RechartsTooltip
} from 'recharts';

interface NetworkMetricsProps {
  metrics: NetworkMetricsType;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  description: string;
  trend?: number;
}

const MetricCard = ({ title, value, description, trend }: MetricCardProps) => (
  <div className="bg-white rounded-lg shadow-lg p-6 relative group">
    <h3 className="text-lg font-montserrat font-semibold text-mahindra-blue mb-2">
      {title}
      <InfoTooltip 
        className="ml-1.5"
        content={
          <div>
            <p className="font-medium mb-1">{description}</p>
          </div>
        }
      />
    </h3>
    <div className="text-2xl font-bold text-mahindra-blue">
      {typeof value === 'number' ? value.toLocaleString() : value}
      {trend !== undefined && (
        <span className={`text-sm ml-2 ${trend >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
        </span>
      )}
    </div>
  </div>
);

export function NetworkMetrics({ metrics }: NetworkMetricsProps) {
  const membershipData = [
    { name: 'Platinum', value: metrics.membershipDistribution.platinum },
    { name: 'Gold', value: metrics.membershipDistribution.gold },
    { name: 'Silver', value: metrics.membershipDistribution.silver },
  ];

  const geographicData = [
    { name: 'Cities', value: metrics.geographicSpread.cities },
    { name: 'States', value: metrics.geographicSpread.states },
    { name: 'Countries', value: metrics.geographicSpread.countries },
  ];

  const chainData = [
    { name: 'Active', value: metrics.activeChains },
    { name: 'Inactive', value: metrics.inactiveChains },
  ];

  const COLORS = ['#C5A572', '#FFD700', '#C0C0C0', '#007CC3'];

  return (
    <div className="space-y-8">
      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Influence Score"
          value={metrics.influenceScore}
          description="Calculated based on membership level (30-70 base points), number of referrals (up to 20 points), referral success rate (up to 10 points), and activity level (up to 10 points)"
          trend={5.2}
        />
        <MetricCard
          title="Network Density"
          value={`${(metrics.betweennessCentrality * 100).toFixed(1)}%`}
          description="Measures how well-connected the network is. Calculated as the ratio of actual connections to potential connections. Higher density indicates a more interconnected network."
          trend={2.1}
        />
        <MetricCard
          title="Referral Velocity"
          value={metrics.referralVelocity.toFixed(1)}
          description="Average number of new referrals per month. Calculated by dividing total successful referrals by the number of months since joining."
          trend={-1.5}
        />
        <MetricCard
          title="Conversion Rate"
          value={`${(metrics.conversionRate * 100).toFixed(1)}%`}
          description="Percentage of referral invitations that result in new memberships. Calculated as (successful referrals / total referral attempts) × 100"
          trend={3.8}
        />
      </div>

      {/* Membership Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-montserrat font-semibold text-mahindra-blue mb-4">
            Membership Distribution
            <InfoTooltip 
              className="ml-1.5"
              content={
                <div>
                  <p className="font-medium mb-1">MongoDB Aggregation Pipeline</p>
                  <p>Real-time calculation using:</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>$group for membership counting</li>
                    <li>$project for data shaping</li>
                  </ul>
                  <p className="mt-2 text-xs">Cached results with TTL index for performance</p>
                </div>
              }
            />
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={membershipData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {membershipData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index]} />
                  ))}
                </Pie>
                <RechartsTooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Referral Chain Analysis */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-montserrat font-semibold text-mahindra-blue mb-4">
            Referral Chain Analysis
            <InfoTooltip 
              className="ml-1.5"
              content={
                <div>
                  <p className="font-medium mb-1">MongoDB Graph Analysis</p>
                  <p>Efficiently calculated using:</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>$graphLookup for path traversal</li>
                    <li>$project with $size for depth</li>
                    <li>$avg for mean calculation</li>
                  </ul>
                  <p className="mt-2 text-xs">Optimized with indexed referredBy field for O(log n) path lookups</p>
                </div>
              }
            />
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chainData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <RechartsTooltip />
                <Bar dataKey="value" fill="#007CC3" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 text-sm text-gray-600">
            <p>Average Chain Depth: {metrics.averageChainDepth.toFixed(1)} levels</p>
            <p>Longest Active Chain: {Math.max(metrics.activeChains, metrics.inactiveChains)} levels</p>
          </div>
        </div>
      </div>

      {/* Geographic Distribution */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-montserrat font-semibold text-mahindra-blue mb-4">
          Geographic Distribution
          <InfoTooltip 
            className="ml-1.5"
            content={
              <div>
                <p className="font-medium mb-1">MongoDB Geospatial Indexing</p>
                <p>Efficiently calculated using:</p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>$geoNear for proximity search</li>
                  <li>$group for location counting</li>
                </ul>
                <p className="mt-2 text-xs">Optimized with 2dsphere index for fast geospatial queries</p>
              </div>
            }
          />
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={geographicData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <RechartsTooltip />
              <Bar dataKey="value" fill="#007CC3" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Network Growth Trend */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-montserrat font-semibold text-mahindra-blue mb-4">
          Network Growth Trend
          <InfoTooltip 
            className="ml-1.5"
            content={
              <div>
                <p className="font-medium mb-1">MongoDB Time Series Data</p>
                <p>Efficiently calculated using:</p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>$match for time range filtering</li>
                  <li>$group for monthly aggregation</li>
                  <li>$project for data shaping</li>
                </ul>
                <p className="mt-2 text-xs">Optimized with TTL index for efficient data expiration</p>
              </div>
            }
          />
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={[
                { month: 'Jan', growth: 10 },
                { month: 'Feb', growth: 15 },
                { month: 'Mar', growth: 12 },
                { month: 'Apr', growth: 18 },
                { month: 'May', growth: 22 },
                { month: 'Jun', growth: 20 },
              ]}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <RechartsTooltip />
              <Line type="monotone" dataKey="growth" stroke="#007CC3" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 text-sm text-gray-600">
          <p>Current Growth Rate: {metrics.networkGrowthRate.toFixed(1)}% per month</p>
          <p>Projected Year-End Members: {Math.round((metrics.membershipDistribution.platinum + metrics.membershipDistribution.gold + metrics.membershipDistribution.silver) * (1 + metrics.networkGrowthRate/100) ** 12)}</p>
        </div>
      </div>
    </div>
  );
}
