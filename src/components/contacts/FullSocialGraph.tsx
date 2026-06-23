import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { FollowEdge, SocialUser } from '@/models/social';

interface FullSocialGraphProps {
  me: number;
  nodes: SocialUser[];
  edges: FollowEdge[];
  onNodeClick?: (userId: number) => void;
}

interface SimNode extends SocialUser, d3.SimulationNodeDatum {
  reachable: boolean;
}

const SLATE = '#001E2B';
const SPRING_GREEN = '#00ED64';
const SKY = '#00D2FF';

// Who's part of "your" network vs background noise: a simple undirected BFS
// over the follow edges from `me`, same idea as the seed data's deliberately
// isolated filler users - this is what lets the full graph visually separate
// your connected cluster from the rest of the database at a glance.
function computeReachable(me: number, edges: FollowEdge[]): Set<number> {
  const adjacency = new Map<number, number[]>();
  for (const edge of edges) {
    if (!adjacency.has(edge.userId)) adjacency.set(edge.userId, []);
    if (!adjacency.has(edge.fellowId)) adjacency.set(edge.fellowId, []);
    adjacency.get(edge.userId)!.push(edge.fellowId);
    adjacency.get(edge.fellowId)!.push(edge.userId);
  }

  const visited = new Set<number>([me]);
  const queue = [me];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const neighbor of adjacency.get(current) ?? []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  return visited;
}

export function FullSocialGraph({ me, nodes, edges, onNodeClick }: FullSocialGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;
    const reachable = computeReachable(me, edges);

    const simNodes: SimNode[] = nodes.map((n) => ({ ...n, reachable: reachable.has(n.userId) }));
    const nodeById = new Map(simNodes.map((n) => [n.userId, n]));
    const simLinks = edges
      .filter((e) => nodeById.has(e.userId) && nodeById.has(e.fellowId))
      .map((e) => ({ source: e.userId, target: e.fellowId }));

    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current).attr('width', width).attr('height', height);
    const g = svg.append('g');

    svg.call(
      d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.3, 4])
        .on('zoom', (event) => g.attr('transform', event.transform)),
    );

    const simulation = d3
      .forceSimulation(simNodes)
      .force(
        'link',
        d3
          .forceLink(simLinks)
          .id((d) => (d as SimNode).userId)
          .distance(70),
      )
      .force('charge', d3.forceManyBody().strength(-120))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(18));

    const link = g
      .append('g')
      .selectAll('line')
      .data(simLinks)
      .join('line')
      .attr('stroke', SLATE)
      .attr('stroke-opacity', 0.2)
      .attr('stroke-width', 1.2);

    const dragBehavior = d3
      .drag<SVGGElement, SimNode>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    const node = g
      .append('g')
      .selectAll('g')
      .data(simNodes)
      .join('g')
      .style('cursor', onNodeClick ? 'pointer' : 'default')
      .on('click', (_event, d) => onNodeClick?.(d.userId))
      // d3's Selection<SVGGElement, ...> and the broader BaseType | SVGGElement
      // selection .join() actually returns don't unify cleanly - a known d3
      // typings gap, not a real type mismatch at runtime.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .call(dragBehavior as any);

    node
      .append('circle')
      .attr('r', (d) => (d.userId === me ? 14 : 8))
      .attr('fill', (d) => (d.userId === me ? SLATE : d.reachable ? SPRING_GREEN : SKY))
      .attr('stroke', SLATE)
      .attr('stroke-width', 1.5);

    node
      .append('text')
      .text((d) => (d.userId === me ? d.name.split(' ')[0] : d.handle))
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => (d.userId === me ? 26 : 18))
      .attr('font-size', '10px')
      .attr('fill', SLATE);

    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as unknown as SimNode).x ?? 0)
        .attr('y1', (d) => (d.source as unknown as SimNode).y ?? 0)
        .attr('x2', (d) => (d.target as unknown as SimNode).x ?? 0)
        .attr('y2', (d) => (d.target as unknown as SimNode).y ?? 0);

      node.attr('transform', (d) => `translate(${d.x ?? 0}, ${d.y ?? 0})`);
    });

    return () => {
      simulation.stop();
    };
  }, [me, nodes, edges, onNodeClick]);

  return (
    <div className="relative w-full h-full">
      <svg ref={svgRef} className="w-full h-full" />
      <div className="absolute bottom-3 left-3 bg-mongodb-white/90 rounded-md px-3 py-2 text-xs text-mongodb-slate/80 flex gap-4">
        <LegendDot color={SLATE} label="You" />
        <LegendDot color={SPRING_GREEN} label="Your network" />
        <LegendDot color={SKY} label="Unconnected" />
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
