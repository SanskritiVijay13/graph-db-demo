import { ReactNode } from 'react';
import { ContactProfileResponse } from '@/models/social';
import { InfoTooltip } from '@/components/contacts/InfoTooltip';

interface ContactProfilePanelProps {
  open: boolean;
  loading: boolean;
  profile: ContactProfileResponse | null;
  onClose: () => void;
  onSelectContact: (userId: number) => void;
}

export function ContactProfilePanel({ open, loading, profile, onClose, onSelectContact }: ContactProfilePanelProps) {
  return (
    <>
      <div
        className={`fixed inset-0 bg-mongodb-slate/40 transition-opacity z-40 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-sm bg-mongodb-white shadow-xl z-50 transform transition-transform duration-300 ease-in-out overflow-y-auto ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex justify-end px-4 pt-3">
          <button onClick={onClose} className="text-mongodb-slate/50 hover:text-mongodb-slate text-sm font-medium">
            Close
          </button>
        </div>

        {loading && <p className="px-6 pb-6 text-sm text-mongodb-slate/60">Loading social graph...</p>}

        {!loading && profile && (
          <div>
            <div className="px-6 pb-6 border-b border-mongodb-slate/10 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold text-mongodb-slate">{profile.profile.name}</h2>
                <p className="text-sm text-mongodb-slate/60">
                  {profile.profile.handle} &middot; {profile.profile.city}, {profile.profile.country}
                </p>
              </div>
              <div className="text-right shrink-0 ml-4">
                <p className="text-xs font-medium text-mongodb-slate/60 flex items-center justify-end gap-1">
                  Influence Score
                  <InfoTooltip
                    title="Their Network Size, Not Your Rank"
                    summary="followers × 10 + following — a property of this person alone."
                    points={[
                      'Computed independently of the ranking tiers',
                      'A direct contact can have a lower score than a friend-of-a-friend and still outrank them',
                      'This number answers "how connected are they", not "why am I seeing them"',
                    ]}
                  />
                </p>
                <p className="text-2xl font-bold text-mongodb-forest-green">{profile.influenceScore}</p>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {profile.mutualConnections.length > 0 && (
                <Section
                  title={`Mutual Connections (${profile.mutualConnections.length})`}
                  info={
                    <InfoTooltip
                      title="Set Intersection, Not a Single Pipeline"
                      summary="Counts anyone in your network who also connects to this person."
                      points={[
                        'Union of (people you follow) ∪ (people who follow you)',
                        'Intersected with this person’s followers',
                        "Matches the list's mutual count exactly — both use the same unified total",
                      ]}
                    />
                  }
                >
                  {profile.mutualConnections.map((person) => (
                    <PersonRow
                      key={person.userId}
                      person={person}
                      tag={person.via === 'contact' ? 'via your contact' : 'via your follower'}
                      onClick={() => onSelectContact(person.userId)}
                    />
                  ))}
                </Section>
              )}

              <Section
                title={`Follows (${profile.directFollowing.length})`}
                info={
                  <InfoTooltip
                    title="$lookup, Not $graphLookup"
                    summary="This only needs one hop, so a plain join is the right tool — applies to Follows and Followers below."
                    points={[
                      "$graphLookup's recursion/cycle-detection overhead only pays off for multi-hop traversal",
                      'The ranking pipelines use $graphLookup because they need 2 hops',
                      'This panel only needs direct connections, so $lookup is simpler and just as fast',
                    ]}
                  />
                }
              >
                {profile.directFollowing.length === 0 && <EmptyNote text="Not following anyone yet." />}
                {profile.directFollowing.map((person) => (
                  <PersonRow key={person.userId} person={person} onClick={() => onSelectContact(person.userId)} />
                ))}
              </Section>

              <Section title={`Followers (${profile.directFollowers.length})`}>
                {profile.directFollowers.length === 0 && <EmptyNote text="No followers yet." />}
                {profile.directFollowers.map((person) => (
                  <PersonRow key={person.userId} person={person} onClick={() => onSelectContact(person.userId)} />
                ))}
              </Section>

              <details className="text-sm">
                <summary className="cursor-pointer font-medium text-mongodb-slate/70">
                  View $lookup pipeline used
                </summary>
                <pre className="mt-2 bg-mongodb-evergreen text-mongodb-mist text-xs rounded-md p-3 overflow-x-auto">
                  {JSON.stringify(profile.pipeline, null, 2)}
                </pre>
              </details>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function Section({
  title,
  info,
  children,
}: {
  title: string;
  info?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-mongodb-slate mb-2 flex items-center gap-1.5">
        {title}
        {info}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return <p className="text-xs text-mongodb-slate/50">{text}</p>;
}

function PersonRow({
  person,
  tag,
  onClick,
}: {
  person: { userId: number; name: string; handle: string };
  tag?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between bg-mongodb-mist hover:bg-mongodb-sky/20 rounded-md px-3 py-2 text-left transition-colors"
    >
      <div>
        <p className="text-sm font-medium text-mongodb-slate">{person.name}</p>
        <p className="text-xs text-mongodb-slate/60">{person.handle}</p>
      </div>
      {tag && (
        <span className="text-[10px] font-semibold uppercase tracking-wide text-mongodb-forest-green shrink-0 ml-2">
          {tag}
        </span>
      )}
    </button>
  );
}
