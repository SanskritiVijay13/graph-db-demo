import { GraphEdge, RankedContact, SocialUser, TIER_LABELS } from '@/models/social';

interface ContactNetworkGraphProps {
  me: SocialUser;
  results: RankedContact[];
  edges: GraphEdge[];
  highlightIds?: Set<number>;
  onNodeClick?: (userId: number) => void;
}

const SLATE = '#001E2B';
const SPRING_GREEN = '#00ED64';

const TIER_COLORS: Record<number, string> = {
  0: SLATE, // me
  1: SPRING_GREEN,
  2: '#00D2FF', // sky
  3: '#F9EBFF', // lavender
  4: '#E9FF99', // lime
};

// Distance from "me" encodes rank: closer = higher priority. This is a fixed
// radial layout (no force simulation) so the tier ordering is always visually
// obvious, instead of depending on how a physics simulation happens to settle.
const TIER_RADIUS: Record<number, number> = { 1: 110, 2: 200, 3: 260, 4: 320 };

const SIZE = 640;
const CENTER = SIZE / 2;

interface PositionedNode {
  userId: number;
  name: string;
  handle: string;
  tier: number;
  x: number;
  y: number;
}

export function ContactNetworkGraph({ me, results, edges, highlightIds, onNodeClick }: ContactNetworkGraphProps) {
  const byTier = new Map<number, RankedContact[]>();
  for (const r of results) {
    if (!byTier.has(r.tier)) byTier.set(r.tier, []);
    byTier.get(r.tier)!.push(r);
  }

  const positioned: PositionedNode[] = [
    { userId: me.userId, name: me.name, handle: me.handle, tier: 0, x: CENTER, y: CENTER },
  ];

  byTier.forEach((contacts, tier) => {
    const radius = TIER_RADIUS[tier] ?? 320;
    contacts.forEach((contact, i) => {
      // Offset each ring's starting angle so tiers don't all line up on the same spokes.
      const angle = (i / contacts.length) * 2 * Math.PI + tier * 0.6;
      positioned.push({
        userId: contact.userId,
        name: contact.name,
        handle: contact.handle,
        tier,
        x: CENTER + radius * Math.cos(angle),
        y: CENTER + radius * Math.sin(angle),
      });
    });
  });

  const positionById = new Map(positioned.map((n) => [n.userId, n]));

  return (
    <div>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full max-w-2xl mx-auto">
        {Object.entries(TIER_RADIUS).map(([tier, radius]) => (
          <circle
            key={tier}
            cx={CENTER}
            cy={CENTER}
            r={radius}
            fill="none"
            stroke={SLATE}
            strokeOpacity={0.15}
            strokeDasharray="4 4"
          />
        ))}

        {edges.map((edge, i) => {
          const source = positionById.get(edge.source);
          const target = positionById.get(edge.target);
          if (!source || !target) return null;
          return (
            <line
              key={i}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke={SLATE}
              strokeOpacity={0.25}
              strokeWidth={1.5}
            />
          );
        })}

        {positioned.map((node) => {
          const isNew = highlightIds?.has(node.userId) ?? false;
          // Non-"me" tiers include light fills (Lavender, Lime), so every node
          // gets a Slate stroke - that's what keeps them visible against the
          // white/mist canvas regardless of how light the fill color is.
          return (
            <g
              key={node.userId}
              transform={`translate(${node.x}, ${node.y})`}
              onClick={() => onNodeClick?.(node.userId)}
              className={onNodeClick ? 'cursor-pointer' : ''}
            >
              {isNew && (
                <circle
                  r={node.tier === 0 ? 16 : 11}
                  fill="none"
                  stroke={SPRING_GREEN}
                  strokeWidth={3}
                  className="animate-pulse"
                />
              )}
              <circle
                r={node.tier === 0 ? 16 : 11}
                fill={TIER_COLORS[node.tier]}
                stroke={node.tier === 0 ? '#FFFFFF' : SLATE}
                strokeWidth={2}
              />
              <text
                textAnchor="middle"
                dy={node.tier === 0 ? 32 : 26}
                fill={isNew ? '#00684A' : SLATE}
                className={`text-[11px] font-medium ${isNew ? 'font-semibold' : ''}`}
              >
                {node.tier === 0 ? node.name.split(' ')[0] : node.handle}
                {isNew ? ' •' : ''}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="flex flex-wrap gap-4 justify-center mt-2 text-xs text-mongodb-slate/70">
        <LegendDot color={TIER_COLORS[0]} label="You" />
        {([1, 2, 3, 4] as const).map((tier) => (
          <LegendDot key={tier} color={TIER_COLORS[tier]} label={TIER_LABELS[tier]} />
        ))}
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block w-2.5 h-2.5 rounded-full border border-mongodb-slate/20"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}
