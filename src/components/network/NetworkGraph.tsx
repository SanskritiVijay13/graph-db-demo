import { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { NetworkGraph as NetworkGraphType, ReferralNode } from '@/models/types';
import { motion, AnimatePresence } from 'framer-motion';

interface NetworkGraphProps {
  data: NetworkGraphType;
  onNodeClick?: (node: ReferralNode) => void;
}

interface NodeTooltipProps {
  node: ReferralNode;
  x: number;
  y: number;
}

const NodeTooltip = ({ node, x, y }: NodeTooltipProps) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 10 }}
    className="absolute z-50 p-3 bg-white rounded-lg shadow-lg border border-gray-200"
    style={{
      left: x + 10,
      top: y + 10,
      minWidth: '200px'
    }}
  >
    <h4 className="font-montserrat font-semibold text-mahindra-blue">{node.name}</h4>
    <div className="mt-2 space-y-1 text-sm">
      <p>Membership: <span className="font-medium">{node.membershipLevel}</span></p>
      <p>Influence Score: <span className="font-medium">{node.influenceScore.toFixed(2)}</span></p>
      <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
        <div
          className="bg-mahindra-blue rounded-full h-2"
          style={{ width: `${(node.influenceScore / 100) * 100}%` }}
        />
      </div>
    </div>
  </motion.div>
);

const MembershipFilter = ({ activeLevels, onChange }: {
  activeLevels: Set<string>;
  onChange: (levels: Set<string>) => void;
}) => (
  <div className="absolute top-4 left-4 z-10 bg-white rounded-lg shadow-lg p-3 space-y-2">
    <h4 className="font-montserrat font-semibold text-mahindra-blue text-sm">Filter by Level</h4>
    {['PLATINUM', 'GOLD', 'SILVER'].map(level => (
      <label key={level} className="flex items-center space-x-2">
        <input
          type="checkbox"
          checked={activeLevels.has(level)}
          onChange={e => {
            const newLevels = new Set(activeLevels);
            if (e.target.checked) {
              newLevels.add(level);
            } else {
              newLevels.delete(level);
            }
            onChange(newLevels);
          }}
          className="form-checkbox text-mahindra-blue rounded"
        />
        <span className="text-sm">{level}</span>
      </label>
    ))}
  </div>
);

const Controls = ({ onZoomIn, onZoomOut, onReset }: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}) => (
  <div className="absolute bottom-4 right-4 z-10 bg-white rounded-lg shadow-lg p-2 space-x-2">
    <button
      onClick={onZoomIn}
      className="p-2 hover:bg-gray-100 rounded-lg"
      title="Zoom In"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
      </svg>
    </button>
    <button
      onClick={onZoomOut}
      className="p-2 hover:bg-gray-100 rounded-lg"
      title="Zoom Out"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" />
      </svg>
    </button>
    <button
      onClick={onReset}
      className="p-2 hover:bg-gray-100 rounded-lg"
      title="Reset View"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
      </svg>
    </button>
  </div>
);

export function NetworkGraph({ data, onNodeClick }: NetworkGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredNode, setHoveredNode] = useState<{ node: ReferralNode; x: number; y: number } | null>(null);
  const [activeLevels, setActiveLevels] = useState<Set<string>>(new Set(['PLATINUM', 'GOLD', 'SILVER']));
  const [searchTerm, setSearchTerm] = useState('');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedNode, setSelectedNode] = useState<ReferralNode | null>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown>>(null);

  const filteredData = useMemo(() => ({
    nodes: data.nodes.filter(node =>
      activeLevels.has(node.membershipLevel) &&
      (!searchTerm || node.name.toLowerCase().includes(searchTerm.toLowerCase()))
    ),
    links: data.links.filter(link => {
      const source = typeof link.source === 'string' ? link.source : link.source.id;
      const target = typeof link.target === 'string' ? link.target : link.target.id;
      const sourceNode = data.nodes.find(n => n.id === source);
      const targetNode = data.nodes.find(n => n.id === target);
      return sourceNode && targetNode &&
        activeLevels.has(sourceNode.membershipLevel) &&
        activeLevels.has(targetNode.membershipLevel);
    })
  }), [data, activeLevels, searchTerm]);

  const zoomBehavior = useMemo(() => {
    return d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 5])
      .extent([[0, 0], [100, 100]]) // Initial extent, will be updated in useEffect
      .on('zoom', (event) => {
        const g = d3.select(svgRef.current).select('g');
        g.attr('transform', event.transform.toString());
        setZoomLevel(event.transform.k);
      });
  }, []);

  const handleNodeClick = (event: MouseEvent, d: ReferralNode) => {
    event.stopPropagation();

    // Call the parent's click handler
    onNodeClick?.(d);

    if (!svgRef.current) return;

    // Reset previous node's style
    if (selectedNode) {
      d3.select(svgRef.current)
        .selectAll('circle')
        .filter((n: any) => (n as ReferralNode).id === selectedNode.id)
        .attr('stroke', '#fff')
        .attr('stroke-width', 2)
        .attr('r', (n: any) => (n as ReferralNode).radius * 10);
    }

    setSelectedNode(d);

    // Highlight clicked node
    const clickedNode = d3.select(event.currentTarget as Element).select('circle');
    clickedNode
      .attr('stroke', '#4F46E5')
      .attr('stroke-width', 4)
      .attr('r', d.radius * 12);

    // Get the SVG dimensions
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    // Calculate zoom transform
    const scale = 2;
    const x = width / 2 - (d.x || 0) * scale;
    const y = height / 2 - (d.y || 0) * scale;
    const transform = d3.zoomIdentity.translate(x, y).scale(scale);

    // Apply zoom transform with transition
    if (zoomBehaviorRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(750)
        .call(zoomBehaviorRef.current.transform as any, transform);
    }
  };

  const handleBackgroundClick = (event: MouseEvent) => {
    if (!svgRef.current || event.target !== svgRef.current) return;

    // Reset selected node styles
    if (selectedNode) {
      d3.select(svgRef.current)
        .selectAll('circle')
        .filter((n: any) => (n as ReferralNode).id === selectedNode.id)
        .attr('stroke', '#fff')
        .attr('stroke-width', 2)
        .attr('r', (n: any) => (n as ReferralNode).radius * 10);
    }

    setSelectedNode(null);

    // Reset zoom
    if (zoomBehaviorRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(750)
        .call(zoomBehaviorRef.current.transform as any, d3.zoomIdentity);
    }
  };

  useEffect(() => {
    if (!svgRef.current || !filteredData.nodes.length) return;

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    // Clear previous content
    d3.select(svgRef.current).selectAll('*').remove();

    // Create SVG
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .on('click', handleBackgroundClick);

    // Set up zoom behavior
    zoomBehaviorRef.current = zoomBehavior;
    svg.call(zoomBehavior);

    // Create container for graph
    const g = svg.append('g');

    // Create forces
    const simulation = d3.forceSimulation(filteredData.nodes as d3.SimulationNodeDatum[])
      .force('link', d3.forceLink(filteredData.links)
        .id((d: any) => d.id)
        .distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('x', d3.forceX(width / 2))
      .force('y', d3.forceY(height / 2))
      .force('collision', d3.forceCollide().radius((d: any) => d.radius * 20));

    // Create arrow marker
    svg.append('defs').selectAll('marker')
      .data(['end'])
      .join('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 30)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#007CC3');

    // Create links
    const links = g.append('g')
      .selectAll('line')
      .data(filteredData.links)
      .join('line')
      .attr('stroke', '#007CC3')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', (d: any) => Math.sqrt(d.value) * 2)
      .attr('marker-end', 'url(#arrow)');

    // Create node groups
    const nodes = g.selectAll('.node')
      .data(filteredData.nodes)
      .join('g')
      .attr('class', 'node')
      .style('cursor', 'pointer')
      .on('click', handleNodeClick as any)
      .on('mouseover', (event, d) => {
        const [x, y] = d3.pointer(event, svg.node());
        setHoveredNode({ node: d as ReferralNode, x, y });
      })
      .on('mouseout', () => setHoveredNode(null))
      .call(d3.drag<SVGGElement, ReferralNode>()
        .on('start', dragStarted)
        .on('drag', dragging)
        .on('end', dragEnded) as any);

    // Add circles to nodes
    nodes.append('circle')
      .attr('r', (d: ReferralNode) => d.radius * 20)
      .attr('fill', (d: ReferralNode) => getMembershipColor(d.membershipLevel))
      .attr('stroke', (d: ReferralNode) => (d === selectedNode ? '#de5423' : '#fff'))
      .attr('stroke-width',  (d: ReferralNode) => (d === selectedNode ? 4 : 0));

    // Add labels to nodes
    nodes.append('text')
      .text((d: ReferralNode) => d.name)
      .attr('dy', 25)
      .attr('text-anchor', 'middle')
      .attr('fill', '#fff')
      .attr('font-size', '12px')
      .attr('font-family', 'Montserrat');

    // Add membership level badges
    nodes.append('text')
      .text((d: ReferralNode) => d.membershipLevel.charAt(0))
      .attr('dy', 4)
      .attr('text-anchor', 'middle')
      .attr('fill', '#00233D')
      .attr('font-size', '10px')
      .attr('font-weight', 'bold')
      .attr('font-family', 'Montserrat');

    // Update positions on each tick
    simulation.on('tick', () => {
      links
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      nodes.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    function dragStarted(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragging(event: any, d: any) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragEnded(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    return () => {
      simulation.stop();
    };
  }, [filteredData, onNodeClick, zoomBehavior]);

  const getMembershipColor = (level: string) => {
    switch (level.toUpperCase()) {
      case 'PLATINUM':
        return '#C5A572';
      case 'GOLD':
        return '#FFD700';
      case 'SILVER':
        return '#C0C0C0';
      default:
        return '#FFFFFF';
    }
  };

  const handleZoomIn = () => {
    if (!svgRef.current) return;
    zoomBehavior.scaleBy(d3.select(svgRef.current).transition().duration(300), 1.5);
  };

  const handleZoomOut = () => {
    if (!svgRef.current) return;
    zoomBehavior.scaleBy(d3.select(svgRef.current).transition().duration(300), 0.75);
  };

  const handleReset = () => {
    if (!svgRef.current) return;
    zoomBehavior.transform(d3.select(svgRef.current).transition().duration(300), d3.zoomIdentity);
  };

  return (
    <div className="relative w-full h-[600px] bg-mahindra-blue rounded-lg overflow-hidden">
      {/* Search Bar */}
      <div className="absolute top-4 right-4 z-10">
        <input
          type="text"
          placeholder="Search members..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-mahindra-blue"
        />
      </div>

      {/* Membership Filter */}
      <MembershipFilter
        activeLevels={activeLevels}
        onChange={setActiveLevels}
      />

      {/* Zoom Controls */}
      <Controls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onReset={handleReset}
      />

      {/* Network Graph */}
      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ background: 'transparent' }}
      />

      {/* Node Tooltip */}
      <AnimatePresence>
        {hoveredNode && (
          <NodeTooltip
            node={hoveredNode.node}
            x={hoveredNode.x}
            y={hoveredNode.y}
          />
        )}
      </AnimatePresence>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-10 bg-white bg-opacity-90 rounded-lg shadow-lg p-3">
        <h4 className="font-montserrat font-semibold text-mahindra-blue text-sm mb-2">Legend</h4>
        <div className="space-y-1">
          {['PLATINUM', 'GOLD', 'SILVER'].map(level => (
            <div key={level} className="flex items-center space-x-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: getMembershipColor(level) }}
              />
              <span className="text-sm">{level}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
