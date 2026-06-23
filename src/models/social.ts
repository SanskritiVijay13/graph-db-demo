export interface SocialUser {
  userId: number;
  name: string;
  handle: string;
  city: string;
  country: string;
}

export interface FollowEdge {
  userId: number;
  fellowId: number;
  status: 0 | 3; // 0 = active follow, 3 = blocked
}

export type ContactTier = 1 | 2 | 3 | 4;

export const TIER_LABELS: Record<ContactTier, string> = {
  1: 'Your Contact',
  2: 'Friend of a Contact',
  3: 'Follows You',
  4: 'Via a Follower',
};

export interface RankedContact extends SocialUser {
  tier: ContactTier;
  mutualCount: number;
  score?: number;
}

export interface GraphNode {
  userId: number;
  tier: ContactTier | 0; // 0 = the logged-in user
}

export interface GraphEdge {
  source: number;
  target: number;
}

export interface SyncedContact extends SocialUser {
  tier: ContactTier;
}

export interface ContactSyncResponse {
  synced: SyncedContact[];
  timingMs: number;
}

export interface QueryTimings {
  search: number;
  graph: number;
  myNetwork: number;
  myNetworkCacheHit: boolean;
  total: number;
}

export interface SampleDocs {
  user: SocialUser | null;
  follow: FollowEdge | null;
}

export interface ContactSearchResponse {
  query: string;
  me: SocialUser;
  results: RankedContact[];
  graph: {
    nodes: GraphNode[];
    edges: GraphEdge[];
  };
  pipelines: {
    search: unknown[];
    graph: unknown[];
  };
  searchIndexDefinition: unknown;
  sampleDocs: SampleDocs;
  timings: QueryTimings;
}

export interface ResetResponse {
  userCount: number;
  edgeCount: number;
}

export interface MutualConnection extends SocialUser {
  via: 'contact' | 'follower'; // whether this is one of my direct contacts or one of my followers
}

export interface ContactProfileResponse {
  profile: SocialUser;
  influenceScore: number;
  directFollowing: SocialUser[];
  directFollowers: SocialUser[];
  mutualConnections: MutualConnection[];
  pipeline: unknown[];
}
