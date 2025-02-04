import { ObjectId } from 'mongodb';
import { SimulationNodeDatum } from 'd3';
import { TrophyIcon } from '@heroicons/react/24/outline';
import type { ForwardRefExoticComponent, SVGProps, RefAttributes } from 'react';

export type HeroIcon = ForwardRefExoticComponent<Omit<SVGProps<SVGSVGElement>, "ref"> & RefAttributes<SVGSVGElement>>;

interface ReferralMember {
  _id: ObjectId;
  name: string;
  membershipLevel: 'PLATINUM' | 'GOLD' | 'SILVER';
}

export interface Member {
  _id?: ObjectId;
  name: string;
  email: string;
  membershipLevel: 'SILVER' | 'GOLD' | 'PLATINUM';
  joinDate: Date;
  referredBy?: ReferralMember;
  directReferrals?: ReferralMember[];
  referralChain?: ReferralMember[];
  totalReferrals: number;
  referralSuccess: number;
  status: 'ACTIVE' | 'INACTIVE';
  location: {
    city: string;
    state: string;
    country: string;
  };
  profileImage?: string;
  achievements?: Array<{
    title: string;
    description: string;
    icon: HeroIcon;
    dateEarned: Date;
  }>;
  lastActive: Date;
  upgradeHistory?: Array<{
    fromLevel: 'PLATINUM' | 'GOLD' | 'SILVER';
    toLevel: 'PLATINUM' | 'GOLD' | 'SILVER';
    date: Date;
  }>;
  influenceScore: number;
}

export interface Achievement {
  type: 'REFERRAL_MILESTONE' | 'UPGRADE' | 'LOYALTY' | 'ENGAGEMENT';
  title: string;
  description: string;
  dateEarned: Date;
  icon: HeroIcon;
}

export interface UpgradeEvent {
  fromLevel: 'SILVER' | 'GOLD' | 'PLATINUM';
  toLevel: 'SILVER' | 'GOLD' | 'PLATINUM';
  date: Date;
  referralCount: number;
}

export interface ReferralChain {
  _id: ObjectId;
  name: string;
  email: string;
  membershipLevel: string;
  referralDepth: number;
  referralPath: Member[];
}

export interface NetworkMetrics {
  memberId: ObjectId;
  name: string;
  membershipLevel: string;
  influenceScore: number;
  betweennessCentrality: number;
  closenessCentrality: number;
  referralVelocity: number;
  conversionRate: number;
  networkGrowthRate: number;
  activeChains: number;
  inactiveChains: number;
  averageChainDepth: number;
  geographicSpread: {
    cities: number;
    states: number;
    countries: number;
  };
  membershipDistribution: {
    silver: number;
    gold: number;
    platinum: number;
  };
}

export interface ReferralNode extends SimulationNodeDatum {
  id: string;
  memberId: ObjectId;
  name: string;
  membershipLevel: string;
  influenceScore: number;
  radius: number;
}

export interface ReferralLink {
  source: string | ReferralNode;
  target: string | ReferralNode;
  value: number;
}

export interface NetworkGraph {
  nodes: ReferralNode[];
  links: ReferralLink[];
  metrics: {
    totalMembers: number;
    activeMembers: number;
    averageChainLength: number;
    networkDensity: number;
    growthRate: number;
  };
}

export interface TimelineEvent {
  date: Date;
  type: 'JOIN' | 'REFERRAL' | 'UPGRADE' | 'ACHIEVEMENT';
  description: string;
  impact: number;
  relatedMembers?: ObjectId[];
}

export interface MemberAnalytics {
  member: Member;
  networkMetrics: NetworkMetrics;
  timeline: TimelineEvent[];
  predictiveMetrics: {
    churnRisk: number;
    upgradeReadiness: number;
    referralPotential: number;
    networkValue: number;
  };
  referralChains: ReferralChain[];
}

export interface UpgradeCandidate {
  _id: ObjectId;
  name: string;
  membershipLevel: string;
  activeReferrals: number;
  upgradeScore: number;
}
