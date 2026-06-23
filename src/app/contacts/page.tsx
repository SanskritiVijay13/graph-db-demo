'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import {
  ContactProfileResponse,
  ContactSearchResponse,
  ContactSyncResponse,
  RankedContact,
  ResetResponse,
  TIER_LABELS,
} from '@/models/social';
import { ContactNetworkGraph } from '@/components/contacts/ContactNetworkGraph';
import { ContactProfilePanel } from '@/components/contacts/ContactProfilePanel';
import { FullSocialGraph } from '@/components/contacts/FullSocialGraph';
import { InfoTooltip } from '@/components/contacts/InfoTooltip';
import { FullGraphResponse } from '@/app/api/contacts/graph/route';

const TIER_BADGE_STYLES: Record<number, string> = {
  1: 'bg-mongodb-spring-green text-mongodb-slate',
  2: 'bg-mongodb-sky text-mongodb-slate',
  3: 'bg-mongodb-lavender text-mongodb-slate',
  4: 'bg-mongodb-lime text-mongodb-evergreen',
};

type InspectorView = 'index' | 'sampleDoc' | 'query' | null;

async function fetchResults(query: string): Promise<ContactSearchResponse> {
  const res = await fetch(`/api/contacts/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error('Search failed');
  return res.json();
}

// Atlas Search indexes new documents asynchronously, so a search run just
// after a sync can briefly miss them. `pendingIds` names the ids the last
// sync inserted; any fetch (not just the one immediately after syncing) will
// retry until they show up or it gives up, so a later re-search or a fresh
// page load doesn't regress to "missing" results just because it arrived
// before the index caught up.
async function fetchResultsResilient(query: string, pendingIds: Set<number>): Promise<ContactSearchResponse> {
  let result = await fetchResults(query);
  for (let attempt = 0; attempt < 5 && pendingIds.size > 0; attempt++) {
    const allPresent = Array.from(pendingIds).every((id) => result.results.some((r) => r.userId === id));
    if (allPresent) break;
    await new Promise((resolve) => setTimeout(resolve, 600));
    result = await fetchResults(query);
  }
  return result;
}

export default function ContactsPage() {
  const [query, setQuery] = useState('dev');
  const [data, setData] = useState<ContactSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inspectorView, setInspectorView] = useState<InspectorView>(null);
  const [view, setView] = useState<'list' | 'graph'>('list');
  const [syncing, setSyncing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [newlySyncedIds, setNewlySyncedIds] = useState<Set<number>>(new Set());
  const [profileUserId, setProfileUserId] = useState<number | null>(null);
  const [profileData, setProfileData] = useState<ContactProfileResponse | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [fullGraphOpen, setFullGraphOpen] = useState(false);
  const [fullGraphData, setFullGraphData] = useState<FullGraphResponse | null>(null);
  const [fullGraphLoading, setFullGraphLoading] = useState(false);

  // Ids the most recent sync inserted that we want every subsequent fetch to
  // confirm, plus a counter so a slower, earlier fetch can never clobber a
  // faster, later one's result (e.g. typing in the search box while the sync
  // handler's own fetch is still resolving).
  const pendingIdsRef = useRef<Set<number>>(new Set());
  const requestIdRef = useRef(0);

  useEffect(() => {
    const handle = setTimeout(() => {
      const requestId = ++requestIdRef.current;
      setLoading(true);
      setError(null);
      fetchResultsResilient(query, pendingIdsRef.current)
        .then((result) => {
          if (requestId === requestIdRef.current) setData(result);
        })
        .catch(() => {
          if (requestId === requestIdRef.current) setError('Failed to load recommendations.');
        })
        .finally(() => {
          if (requestId === requestIdRef.current) setLoading(false);
        });
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  async function handleSync() {
    setSyncing(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/contacts/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) throw new Error('Sync failed');
      const { synced, timingMs }: ContactSyncResponse = await res.json();
      const syncedIds = new Set(synced.map((s) => s.userId));
      setNewlySyncedIds(syncedIds);
      pendingIdsRef.current = syncedIds;

      const requestId = ++requestIdRef.current;
      const refreshed = await fetchResultsResilient(query, syncedIds);
      const appeared = refreshed.results.filter((r) => syncedIds.has(r.userId)).length;
      if (requestId === requestIdRef.current) setData(refreshed);

      // Tiers 1 & 3 are real direct connections (you follow them / they follow
      // you); Tiers 2 & 4 are added as 2nd-degree, reachable only through an
      // existing contact or follower - call this out explicitly so it's not a
      // silent surprise that not every "synced contact" is actually yours.
      const directCount = synced.filter((s) => s.tier === 1 || s.tier === 3).length;
      const indirectCount = synced.length - directCount;
      const breakdown = `${directCount} direct connection${directCount !== 1 ? 's' : ''}, ${indirectCount} via your existing network`;

      setStatusMessage(
        appeared > 0
          ? `Synced ${synced.length} new contacts in ${timingMs}ms (${breakdown}) — ${appeared} just appeared in your recommendations.`
          : `Synced ${synced.length} new contacts in ${timingMs}ms (${breakdown}). Try searching for one of their names.`,
      );
    } catch {
      setStatusMessage('Sync failed. Please try again.');
    } finally {
      setSyncing(false);
    }
  }

  async function openProfile(userId: number) {
    setProfileUserId(userId);
    setProfileLoading(true);
    try {
      const res = await fetch(`/api/contacts/profile/${userId}`);
      if (!res.ok) throw new Error('Failed to load profile');
      setProfileData(await res.json());
    } catch {
      setProfileData(null);
    } finally {
      setProfileLoading(false);
    }
  }

  async function openFullGraph() {
    setFullGraphOpen(true);
    setFullGraphLoading(true);
    try {
      const res = await fetch('/api/contacts/graph');
      if (!res.ok) throw new Error('Failed to load graph');
      setFullGraphData(await res.json());
    } catch {
      setFullGraphData(null);
    } finally {
      setFullGraphLoading(false);
    }
  }

  async function handleReset() {
    setResetting(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/contacts/reset', { method: 'POST' });
      if (!res.ok) throw new Error('Reset failed');
      const { userCount, edgeCount }: ResetResponse = await res.json();
      setNewlySyncedIds(new Set());
      pendingIdsRef.current = new Set();

      const requestId = ++requestIdRef.current;
      const refreshed = await fetchResults(query);
      if (requestId === requestIdRef.current) setData(refreshed);
      setStatusMessage(`Demo data reset — back to ${userCount} users and ${edgeCount} follow edges.`);
    } catch {
      setStatusMessage('Reset failed. Please try again.');
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="min-h-screen bg-mongodb-mist">
      <header className="bg-mongodb-white border-b border-mongodb-slate/10">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-mongodb-slate">Travel Buddy Suggestions</h1>
            {data && (
              <p className="text-sm text-mongodb-slate/60">
                Logged in as {data.me.name} ({data.me.handle})
              </p>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <SecondaryButton onClick={() => setInspectorView('index')} disabled={!data}>
              Show Index
            </SecondaryButton>
            <SecondaryButton onClick={() => setInspectorView('sampleDoc')} disabled={!data}>
              Sample Doc
            </SecondaryButton>
            <SecondaryButton onClick={() => setInspectorView('query')} disabled={!data}>
              Show Query
            </SecondaryButton>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="bg-mongodb-white border border-mongodb-slate/10 rounded-lg px-4 py-3 mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-mongodb-slate flex items-center gap-1.5">
              Sync Contacts
              <InfoTooltip
                title="Real-Time Graph Mutation"
                summary="This inserts directly into MongoDB and immediately re-runs the live ranking pipelines — nothing is mocked."
                points={[
                  'Only 2 of the 5 become real direct connections (you follow them, or they follow you) — Tiers 1 & 3',
                  "The other 2 are added 2nd-degree, reachable only through an existing contact/follower — Tiers 2 & 4 — they're not added as your direct contact",
                  "Names are biased to start with your search term so they're instantly findable",
                  'Atlas Search indexes new docs asynchronously, so the UI polls briefly rather than trusting one refetch',
                ]}
              />
            </p>
            <p className="text-xs text-mongodb-slate/60">
              Import contacts from your phone to grow your travel network in real time.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <SecondaryButton onClick={handleReset} disabled={resetting || syncing}>
              {resetting ? 'Resetting...' : 'Reset Demo'}
            </SecondaryButton>
            <button
              onClick={handleSync}
              disabled={syncing || resetting}
              className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-md bg-mongodb-spring-green text-mongodb-slate hover:bg-mongodb-forest-green hover:text-mongodb-white disabled:opacity-50 transition-colors"
            >
              <ArrowPathIcon className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Contacts'}
            </button>
          </div>
        </div>

        {statusMessage && (
          <div className="bg-mongodb-lime border border-mongodb-evergreen/20 text-mongodb-evergreen text-sm rounded-lg px-4 py-2.5 mb-6">
            {statusMessage}
          </div>
        )}

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people by name or handle..."
          className="w-full rounded-md border border-mongodb-slate/30 px-4 py-2.5 text-mongodb-slate focus:outline-none focus:ring-2 focus:ring-mongodb-clear-blue"
        />

        {!loading && data && query && (
          <p className="text-xs text-mongodb-slate/50 mt-2 flex items-center gap-1.5">
            {data.results.length} result{data.results.length !== 1 ? 's' : ''} · query executed in{' '}
            {data.timings.total}ms
            <InfoTooltip
              title="Tiered $graphLookup Ranking"
              summary="Ranked by how you're actually connected, not by who's most popular."
              points={[
                'One recursive $graphLookup finds direct contacts (hop 0) and friends-of-friends (hop 1) in a single pass',
                'A second $graphLookup does the same for your followers',
                'A direct contact always outranks a friend-of-a-friend, even if reachable both ways',
              ]}
            />
          </p>
        )}

        {!loading && data && query && (
          <p className="text-xs text-mongodb-slate/40 mt-1 flex items-center gap-1.5">
            Your contacts/followers/blocked list:{' '}
            <span className={data.timings.myNetworkCacheHit ? 'text-mongodb-forest-green font-medium' : ''}>
              {data.timings.myNetworkCacheHit ? 'cache hit' : 'fetched fresh'} ({data.timings.myNetwork}ms)
            </span>
            <InfoTooltip
              title="Short-TTL Edge Cache"
              summary="Your direct contacts, followers, and blocked list are cached for 15s — not the ranked results."
              points={[
                'Caches only raw edge lists (who follows/is followed by you), never a derived number like a mutual count or tier',
                'Invalidated immediately by Sync Contacts and Reset Demo, so a write you just made is never hidden by a stale cache',
                'The $graphLookup ranking query above is never cached — only this one supporting lookup is',
              ]}
            />
          </p>
        )}

        {data && data.results.length > 0 && (
          <div className="flex gap-2 mt-4 items-center justify-between">
            <div className="flex gap-2 items-center">
              <ViewToggleButton active={view === 'list'} onClick={() => setView('list')}>
                List
              </ViewToggleButton>
              <ViewToggleButton active={view === 'graph'} onClick={() => setView('graph')}>
                Network Graph
              </ViewToggleButton>
              {view === 'graph' && (
                <InfoTooltip
                  title="Fixed Radial Layout"
                  summary="Distance from you encodes rank — this is deliberately not a physics simulation."
                  points={[
                    'Each tier sits on its own fixed-radius ring, positioned with plain trigonometry',
                    'A force simulation could settle a Tier 2 node closer to center than a Tier 1 node depending on link pulls',
                    'Fixing the radius by tier guarantees the ranking is always visually unambiguous',
                  ]}
                />
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <SecondaryButton onClick={openFullGraph}>View Full Graph</SecondaryButton>
              <InfoTooltip
                title="Force-Directed, Whole Database"
                summary="Unlike the egocentric Network Graph, this renders every user and edge in the database."
                points={[
                  'D3 force simulation (link, charge, center, collision) — drag and zoom enabled',
                  'Colored by reachability from you via a simple BFS over follow edges, not by tier',
                  'Reveals which seeded users are isolated noise vs. part of your connected cluster',
                ]}
              />
            </div>
          </div>
        )}

        <div className="mt-6">
          {loading && <p className="text-mongodb-slate/60 text-sm">Searching...</p>}
          {error && <p className="text-mongodb-evergreen font-semibold text-sm">{error}</p>}
          {!loading && !error && data && query && data.results.length === 0 && (
            <p className="text-mongodb-slate/60 text-sm">No matching contacts found in your network.</p>
          )}

          {!loading && data && data.results.length > 0 && view === 'list' && (
            <div className="space-y-3">
              {data.results.map((contact) => (
                <ContactRow
                  key={contact.userId}
                  contact={contact}
                  isNew={newlySyncedIds.has(contact.userId)}
                  onClick={() => openProfile(contact.userId)}
                />
              ))}
            </div>
          )}

          {!loading && data && data.results.length > 0 && view === 'graph' && (
            <ContactNetworkGraph
              me={data.me}
              results={data.results}
              edges={data.graph.edges}
              highlightIds={newlySyncedIds}
              onNodeClick={openProfile}
            />
          )}
        </div>
      </main>

      <ContactProfilePanel
        open={profileUserId !== null}
        loading={profileLoading}
        profile={profileData}
        onClose={() => setProfileUserId(null)}
        onSelectContact={openProfile}
      />

      <Dialog open={inspectorView !== null} onClose={() => setInspectorView(null)} className="relative z-50">
        <div className="fixed inset-0 bg-mongodb-slate/40" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="w-full max-w-2xl rounded-lg bg-mongodb-white p-6 max-h-[85vh] overflow-y-auto">
            <DialogTitle className="text-lg font-semibold text-mongodb-slate mb-4">
              {inspectorView === 'index' && 'Atlas Search Index Definition'}
              {inspectorView === 'sampleDoc' && 'Sample Documents'}
              {inspectorView === 'query' && 'Aggregation Pipelines'}
            </DialogTitle>

            {inspectorView === 'index' && (
              <QueryBlock title="users_search index definition" value={data?.searchIndexDefinition} />
            )}

            {inspectorView === 'sampleDoc' && (
              <>
                <QueryBlock title="Sample document — users collection" value={data?.sampleDocs.user} />
                <QueryBlock title="Sample document — follows collection" value={data?.sampleDocs.follow} />
              </>
            )}

            {inspectorView === 'query' && (
              <>
                <QueryBlock
                  title={`Atlas Search Query (keyword match) — ${data?.timings.search ?? 0}ms`}
                  value={data?.pipelines.search}
                  description='Finds every user whose name or handle starts with what you typed, using the users_search autocomplete index. Runs independently of the graph below — it has no idea who you’re connected to. It runs at the same time as the graph query, not after it; the results only get intersected together once both come back (see the note below).'
                />
                <QueryBlock
                  title={`$graphLookup — Contacts, Followers & Friends of Friends — ${data?.timings.graph ?? 0}ms`}
                  value={data?.pipelines.graph}
                  description='One pipeline, two $graphLookup traversals stitched together with $unionWith: the first walks outward from you (hop 0 = who you directly follow = Tier 1, hop 1 = who they follow = Tier 2); the second runs once per follower and looks at what each of them follows (the followers themselves = Tier 3, who they follow = Tier 4). A $group afterward merges anyone reachable both ways — taking the best tier and summing mutual counts — and a final $sort orders everything by tier, then by mutual count. All of that runs inside MongoDB; nothing here is JavaScript.'
                />
                <p className="text-xs text-mongodb-slate/50 border-t border-mongodb-slate/10 pt-3 mt-1">
                  The search query and the graph query above run concurrently via <code>Promise.all</code> —
                  neither waits on the other. The merge and sort you can see inside the graph pipeline already
                  happened in MongoDB by the time these results come back. The one thing still done in
                  application code is intersecting the two: a graph candidate is only kept if it also matched
                  the Atlas Search query. That intersection stays server-side-but-not-single-pipeline on
                  purpose — <code>$search</code> has to lead its own pipeline, and combining it with a
                  traversal rooted at one user would mean re-running that traversal once per keyword match
                  instead of once.
                </p>
              </>
            )}

            <button
              onClick={() => setInspectorView(null)}
              className="mt-2 w-full rounded-md bg-mongodb-slate text-mongodb-white py-2 text-sm font-medium hover:bg-mongodb-evergreen transition-colors"
            >
              Close
            </button>
          </DialogPanel>
        </div>
      </Dialog>

      <Dialog open={fullGraphOpen} onClose={() => setFullGraphOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-mongodb-slate/40" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="w-full max-w-5xl h-[85vh] rounded-lg bg-mongodb-white p-4 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <DialogTitle className="text-lg font-semibold text-mongodb-slate">
                Full Graph — every user and follow edge in the database
              </DialogTitle>
              <button
                onClick={() => setFullGraphOpen(false)}
                className="text-mongodb-slate/50 hover:text-mongodb-slate text-sm font-medium"
              >
                Close
              </button>
            </div>
            <div className="flex-1 border border-mongodb-slate/10 rounded-md overflow-hidden">
              {fullGraphLoading && (
                <p className="p-6 text-sm text-mongodb-slate/60">Loading the full graph...</p>
              )}
              {!fullGraphLoading && fullGraphData && (
                <FullSocialGraph
                  me={fullGraphData.me}
                  nodes={fullGraphData.nodes}
                  edges={fullGraphData.edges}
                  onNodeClick={(userId) => {
                    setFullGraphOpen(false);
                    openProfile(userId);
                  }}
                />
              )}
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </div>
  );
}

function SecondaryButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="text-sm font-medium px-3 py-2 rounded-md border border-mongodb-slate/30 text-mongodb-slate hover:bg-mongodb-mist disabled:opacity-50 transition-colors whitespace-nowrap"
    >
      {children}
    </button>
  );
}

function ViewToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${
        active
          ? 'bg-mongodb-slate text-mongodb-white'
          : 'bg-mongodb-white border border-mongodb-slate/30 text-mongodb-slate hover:bg-mongodb-mist'
      }`}
    >
      {children}
    </button>
  );
}

function QueryBlock({
  title,
  value,
  description,
}: {
  title: string;
  value: unknown;
  description?: string;
}) {
  if (value === undefined) return null;
  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-mongodb-slate/80 mb-1">{title}</h3>
      <pre className="bg-mongodb-evergreen text-mongodb-mist text-xs rounded-md p-3 overflow-x-auto">
        {JSON.stringify(value, null, 2)}
      </pre>
      {description && <p className="text-xs text-mongodb-slate/60 mt-1.5">{description}</p>}
    </div>
  );
}

function ContactRow({
  contact,
  isNew,
  onClick,
}: {
  contact: RankedContact;
  isNew: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between border rounded-lg px-4 py-3 text-left transition-colors hover:border-mongodb-clear-blue ${
        isNew ? 'bg-mongodb-mist border-mongodb-spring-green' : 'bg-mongodb-white border-mongodb-slate/10'
      }`}
    >
      <div>
        <div className="flex items-center gap-2">
          <p className="font-medium text-mongodb-slate">{contact.name}</p>
          {isNew && (
            <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-mongodb-slate text-mongodb-spring-green">
              New
            </span>
          )}
        </div>
        <p className="text-sm text-mongodb-slate/60">
          {contact.handle} &middot; {contact.city}, {contact.country}
        </p>
      </div>
      <div className="text-right">
        <span
          className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${TIER_BADGE_STYLES[contact.tier]}`}
        >
          {TIER_LABELS[contact.tier as 1 | 2 | 3 | 4]}
        </span>
        {(contact.tier === 2 || contact.tier === 4) && contact.mutualCount > 0 && (
          <p className="text-xs text-mongodb-clear-blue mt-1 underline">
            {contact.mutualCount} mutual connection{contact.mutualCount > 1 ? 's' : ''}
          </p>
        )}
      </div>
    </button>
  );
}
