import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { ReferralNode, ReferralLink, NetworkGraph as NetworkGraphType } from '@/models/types';

interface NetworkGraphProps {
  data: NetworkGraphType;
  width?: number;
  height?: number;
}

const NetworkGraph: React.FC<NetworkGraphProps> = ({ data, width = 800, height = 600 }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown>>();

  useEffect(() => {
    if (!svgRef.current || !data.nodes.length) return;

    // Clear previous graph
    d3.select(svgRef.current).selectAll("*").remove();

    // Create SVG container
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    // Define color scale for membership levels
    const colorScale = d3.scaleOrdinal<string>()
      .domain(['SILVER', 'GOLD', 'PLATINUM'])
      .range(['#C0C0C0', '#FFD700', '#E5E4E2']);

    // Create force simulation
    const simulation = d3.forceSimulation<ReferralNode>(data.nodes)
      .force('link', d3.forceLink<ReferralNode, ReferralLink>(data.links)
        .id(d => d.id)
        .distance(100))
      .force('charge', d3.forceManyBody<ReferralNode>().strength(-200))
      .force('center', d3.forceCenter<ReferralNode>(width / 2, height / 2))
      .force('collision', d3.forceCollide<ReferralNode>().radius(d => d.radius));

    // Create container for graph
    const container = svg.append('g');

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .extent([[0, 0], [width, height]])
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        container.attr('transform', event.transform);
      });

    svg.call(zoom);
    zoomRef.current = zoom;

    // Create links
    const links = container.append('g')
      .selectAll('line')
      .data(data.links)
      .join('line')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', d => Math.sqrt(d.value));

    // Create nodes
    const nodes = container.append('g')
      .selectAll('g')
      .data(data.nodes)
      .join('g')
      .attr('class', 'node')
      .on('click', (event, d) => {
        event.stopPropagation();
        
        // Reset all nodes to default style
        nodes.selectAll('circle')
          .attr('stroke', '#fff')
          .attr('stroke-width', 1.5)
          .attr('r', n => (n as ReferralNode).radius);

        // Highlight clicked node
        const clickedNode = d3.select(event.currentTarget);
        clickedNode.select('circle')
          .attr('stroke', '#4F46E5')
          .attr('stroke-width', 3)
          .attr('r', (d as ReferralNode).radius * 1.2);

        // Zoom to node
        const transform = d3.zoomIdentity
          .translate(width / 2, height / 2)
          .scale(2)
          .translate(-(d as ReferralNode).x!, -(d as ReferralNode).y!);

        svg.transition()
          .duration(750)
          .call(zoom.transform, transform);
      });

    // Add circles to nodes
    nodes.append('circle')
      .attr('r', d => d.radius)
      .attr('fill', d => colorScale(d.membershipLevel))
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .style('cursor', 'pointer');

    // Add labels to nodes
    nodes.append('text')
      .text(d => d.name)
      .attr('x', d => d.radius + 5)
      .attr('y', 4)
      .attr('font-size', '10px')
      .style('pointer-events', 'none');

    // Add tooltips
    nodes.append('title')
      .text(d => `${d.name}\n${d.membershipLevel}\nInfluence Score: ${d.influenceScore.toFixed(2)}`);

    // Reset zoom on background click
    svg.on('click', (event) => {
      if (event.target === svg.node()) {
        // Reset all nodes to default style
        nodes.selectAll('circle')
          .attr('stroke', '#fff')
          .attr('stroke-width', 1.5)
          .attr('r', n => (n as ReferralNode).radius);

        // Reset zoom
        svg.transition()
          .duration(750)
          .call(zoom.transform, d3.zoomIdentity);
      }
    });

    // Update positions on each tick
    simulation.on('tick', () => {
      links
        .attr('x1', d => (d.source as ReferralNode).x!)
        .attr('y1', d => (d.source as ReferralNode).y!)
        .attr('x2', d => (d.target as ReferralNode).x!)
        .attr('y2', d => (d.target as ReferralNode).y!);

      nodes.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [data, width, height]);

  return (
    <div className="network-graph-container">
      <svg ref={svgRef} className="network-graph"></svg>
      <style jsx>{`
        .network-graph-container {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 16px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        .network-graph {
          display: block;
          margin: 0 auto;
        }
      `}</style>
    </div>
  );
};

export default NetworkGraph;
