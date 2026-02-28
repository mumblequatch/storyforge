import React, { useMemo, useState, useRef, useCallback } from 'react';

const NODE_W = 160;
const NODE_H = 48;
const GAP_X = 220;
const GAP_Y = 90;
const PAD = 40;
const PORT_R = 6;

const StoryMap = ({ scenes, onSelectScene, onConnect }) => {
  const [dragging, setDragging] = useState(null); // { sourceId, x, y }
  const svgRef = useRef(null);

  const layout = useMemo(() => {
    if (scenes.length === 0) return { nodes: [], edges: [], width: 0, height: 0 };

    const startScene = scenes.find(s => s.isStart) || scenes[0];

    // BFS to assign depth layers
    const depthMap = new Map();
    const queue = [{ id: startScene.id, depth: 0 }];
    depthMap.set(startScene.id, 0);

    while (queue.length > 0) {
      const { id, depth } = queue.shift();
      const scene = scenes.find(s => s.id === id);
      if (!scene) continue;

      for (const choice of scene.choices) {
        if (choice.targetSceneId && !depthMap.has(choice.targetSceneId)) {
          depthMap.set(choice.targetSceneId, depth + 1);
          queue.push({ id: choice.targetSceneId, depth: depth + 1 });
        }
      }
    }

    // Find unreachable scenes
    const reachableIds = new Set(depthMap.keys());
    const unreachable = scenes.filter(s => !reachableIds.has(s.id));

    // Group by depth
    const depthGroups = new Map();
    for (const [id, depth] of depthMap) {
      if (!depthGroups.has(depth)) depthGroups.set(depth, []);
      depthGroups.get(depth).push(id);
    }

    // Position nodes
    const positions = new Map();
    for (const [depth, ids] of depthGroups) {
      const x = PAD + depth * GAP_X;
      const totalHeight = ids.length * NODE_H + (ids.length - 1) * (GAP_Y - NODE_H);
      const startY = PAD + (3 * NODE_H - totalHeight) / 2;
      ids.forEach((id, i) => {
        positions.set(id, { x, y: Math.max(PAD, startY + i * GAP_Y) });
      });
    }

    // Position unreachable nodes in a separate row at the bottom
    const maxY = positions.size > 0 ? Math.max(...[...positions.values()].map(p => p.y)) : 0;
    const unreachableY = maxY + GAP_Y + 40;
    unreachable.forEach((scene, i) => {
      positions.set(scene.id, { x: PAD + i * GAP_X, y: unreachableY });
    });

    // Build nodes
    const nodes = scenes.map(scene => {
      const pos = positions.get(scene.id) || { x: PAD, y: PAD };
      const isDeadEnd = !scene.isEnding && scene.choices.filter(c => c.targetSceneId).length === 0;
      const isUnreachable = !reachableIds.has(scene.id);
      return { ...scene, ...pos, isDeadEnd, isUnreachable };
    });

    // Build edges
    const edges = [];
    scenes.forEach(scene => {
      const from = positions.get(scene.id);
      if (!from) return;
      scene.choices.forEach(choice => {
        if (!choice.targetSceneId) return;
        const to = positions.get(choice.targetSceneId);
        if (!to) return;
        edges.push({
          id: `${scene.id}-${choice.id}`,
          x1: from.x + NODE_W,
          y1: from.y + NODE_H / 2,
          x2: to.x,
          y2: to.y + NODE_H / 2,
        });
      });
    });

    const allX = nodes.map(n => n.x + NODE_W);
    const allY = nodes.map(n => n.y + NODE_H);
    const width = Math.max(...allX, 400) + PAD;
    const height = Math.max(...allY, 200) + PAD;

    return { nodes, edges, width, height, unreachableY: unreachable.length > 0 ? unreachableY : null };
  }, [scenes]);

  const getNodeColor = (node) => {
    if (node.isStart) return { fill: '#166534', stroke: '#22c55e', text: '#bbf7d0' };
    if (node.isEnding) return { fill: '#78350f', stroke: '#f59e0b', text: '#fef3c7' };
    if (node.isDeadEnd) return { fill: '#7f1d1d', stroke: '#ef4444', text: '#fecaca' };
    if (node.isUnreachable) return { fill: '#3f3f46', stroke: '#71717a', text: '#a1a1aa' };
    return { fill: '#1e1b4b', stroke: '#7c3aed', text: '#c4b5fd' };
  };

  const getSVGPoint = useCallback((e) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const handlePortMouseDown = useCallback((e, sourceId) => {
    e.stopPropagation();
    const pt = getSVGPoint(e);
    setDragging({ sourceId, x: pt.x, y: pt.y });
  }, [getSVGPoint]);

  const handleMouseMove = useCallback((e) => {
    if (!dragging) return;
    const pt = getSVGPoint(e);
    setDragging(prev => ({ ...prev, x: pt.x, y: pt.y }));
  }, [dragging, getSVGPoint]);

  const handleMouseUp = useCallback((e) => {
    if (!dragging) return;
    // Check if we dropped on an input port
    const target = e.target.closest('[data-input-port]');
    if (target) {
      const targetId = target.getAttribute('data-input-port');
      if (targetId !== dragging.sourceId && onConnect) {
        onConnect(dragging.sourceId, targetId);
      }
    }
    setDragging(null);
  }, [dragging, onConnect]);

  // Source output port position for the drag line
  const dragSource = dragging ? layout.nodes.find(n => n.id === dragging.sourceId) : null;

  return (
    <div className="story-map-panel">
      <div className="story-map-header">
        <h2>Story Map</h2>
        <div className="map-legend">
          <span className="legend-item"><span className="legend-dot" style={{ background: '#22c55e' }}/> Start</span>
          <span className="legend-item"><span className="legend-dot" style={{ background: '#f59e0b' }}/> Ending</span>
          <span className="legend-item"><span className="legend-dot" style={{ background: '#ef4444' }}/> Dead End</span>
          <span className="legend-item"><span className="legend-dot" style={{ background: '#7c3aed' }}/> Scene</span>
          <span className="legend-item" style={{ color: '#a1a1aa', fontSize: '0.75rem', marginLeft: 8 }}>Drag from ● to ● to connect</span>
        </div>
      </div>
      <div className="story-map-scroll">
        <svg
          ref={svgRef}
          width={layout.width}
          height={layout.height}
          className="story-map-svg"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => setDragging(null)}
        >
          {/* Unreachable separator */}
          {layout.unreachableY && (
            <>
              <line
                x1={0} y1={layout.unreachableY - 24}
                x2={layout.width} y2={layout.unreachableY - 24}
                stroke="#3f3f46" strokeDasharray="6 4"
              />
              <text x={PAD} y={layout.unreachableY - 32} fill="#71717a" fontSize="12" fontFamily="DM Sans, sans-serif">
                Unreachable scenes
              </text>
            </>
          )}

          {/* Edges */}
          {layout.edges.map(edge => {
            const dx = edge.x2 - edge.x1;
            const cp = Math.max(40, Math.abs(dx) * 0.4);
            const d = `M ${edge.x1} ${edge.y1} C ${edge.x1 + cp} ${edge.y1}, ${edge.x2 - cp} ${edge.y2}, ${edge.x2} ${edge.y2}`;
            return (
              <g key={edge.id}>
                <path d={d} fill="none" stroke="#4c1d95" strokeWidth="2" opacity="0.6" />
                <polygon
                  points={`${edge.x2},${edge.y2} ${edge.x2 - 8},${edge.y2 - 4} ${edge.x2 - 8},${edge.y2 + 4}`}
                  fill="#7c3aed" opacity="0.7"
                />
              </g>
            );
          })}

          {/* Drag line */}
          {dragging && dragSource && (
            <line
              x1={dragSource.x + NODE_W}
              y1={dragSource.y + NODE_H / 2}
              x2={dragging.x}
              y2={dragging.y}
              stroke="#a78bfa"
              strokeWidth="2"
              strokeDasharray="6 3"
              pointerEvents="none"
            />
          )}

          {/* Nodes */}
          {layout.nodes.map(node => {
            const colors = getNodeColor(node);
            const outX = node.x + NODE_W;
            const outY = node.y + NODE_H / 2;
            const inX = node.x;
            const inY = node.y + NODE_H / 2;
            const isDropTarget = dragging && dragging.sourceId !== node.id;

            return (
              <g key={node.id}>
                {/* Node body */}
                <rect
                  x={node.x} y={node.y}
                  width={NODE_W} height={NODE_H}
                  rx={10} ry={10}
                  fill={colors.fill}
                  stroke={colors.stroke}
                  strokeWidth="2"
                  style={{ cursor: 'pointer' }}
                  onClick={() => onSelectScene(node.id)}
                />
                <text
                  x={node.x + NODE_W / 2}
                  y={node.y + NODE_H / 2 + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={colors.text}
                  fontSize="13"
                  fontFamily="DM Sans, sans-serif"
                  fontWeight="500"
                  pointerEvents="none"
                >
                  {node.title.length > 18 ? node.title.slice(0, 16) + '...' : node.title}
                </text>

                {/* Output port (right side) */}
                {!node.isEnding && (
                  <circle
                    cx={outX} cy={outY} r={PORT_R}
                    fill={dragging?.sourceId === node.id ? '#a78bfa' : '#27272a'}
                    stroke="#7c3aed"
                    strokeWidth="2"
                    style={{ cursor: 'crosshair' }}
                    onMouseDown={(e) => handlePortMouseDown(e, node.id)}
                  />
                )}

                {/* Input port (left side) */}
                <circle
                  cx={inX} cy={inY} r={PORT_R}
                  fill={isDropTarget ? '#a78bfa' : '#27272a'}
                  stroke={isDropTarget ? '#c4b5fd' : '#3f3f46'}
                  strokeWidth="2"
                  style={{ cursor: isDropTarget ? 'pointer' : 'default' }}
                  data-input-port={node.id}
                />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

export default StoryMap;
