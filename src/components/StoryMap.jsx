import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';

const NODE_W = 180;
const NODE_H = 52;
const GAP_X = 260;
const GAP_Y = 100;
const PAD = 60;
const PORT_R = 6;
const MIN_ZOOM = 0.15;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.1;

const StoryMap = ({ scenes, selectedSceneId, onSelectScene, onConnect, onAddScene }) => {
  const [dragging, setDragging] = useState(null); // connection drag: { sourceId, x, y }
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef(null);
  const containerRef = useRef(null);
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

    // Position nodes — left to right by depth, vertically centered per column
    const positions = new Map();
    const maxGroupSize = Math.max(...[...depthGroups.values()].map(g => g.length), 1);
    const totalMaxHeight = maxGroupSize * NODE_H + (maxGroupSize - 1) * (GAP_Y - NODE_H);

    for (const [depth, ids] of depthGroups) {
      const x = PAD + depth * GAP_X;
      const groupHeight = ids.length * NODE_H + (ids.length - 1) * (GAP_Y - NODE_H);
      const startY = PAD + (totalMaxHeight - groupHeight) / 2;
      ids.forEach((id, i) => {
        positions.set(id, { x, y: Math.max(PAD, startY + i * GAP_Y) });
      });
    }

    // Position unreachable nodes in a separate row at the bottom
    const maxY = positions.size > 0 ? Math.max(...[...positions.values()].map(p => p.y)) : 0;
    const unreachableY = maxY + GAP_Y + 60;
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

  // Zoom with scroll wheel
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    // Mouse position relative to container
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Point in world coords under the mouse before zoom
    const worldX = (mx - pan.x) / zoom;
    const worldY = (my - pan.y) / zoom;

    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom + delta));

    // Adjust pan so the world point under the mouse stays fixed
    const newPanX = mx - worldX * newZoom;
    const newPanY = my - worldY * newZoom;

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  }, [zoom, pan]);

  // Attach wheel listener with passive:false
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // +/- keyboard zoom
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        setZoom(z => Math.min(MAX_ZOOM, z + ZOOM_STEP));
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        setZoom(z => Math.max(MIN_ZOOM, z - ZOOM_STEP));
      } else if (e.key === '0') {
        e.preventDefault();
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Pan with mouse drag — track start position to distinguish click from drag
  const handlePanStart = useCallback((e) => {
    if (e.button !== 0 && e.button !== 1) return;
    // Check if we're on an interactive SVG element by walking up the DOM
    let el = e.target;
    while (el && el !== containerRef.current) {
      if (el.dataset && (el.dataset.node || el.dataset.inputPort || el.dataset.outputPort)) return;
      // SVG uses getAttribute
      if (el.getAttribute && (el.getAttribute('data-node') || el.getAttribute('data-input-port') || el.getAttribute('data-output-port'))) return;
      el = el.parentElement || el.parentNode;
    }
    e.preventDefault();
    setIsPanning(true);
    panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y, startX: e.clientX, startY: e.clientY };
  }, [pan]);

  const handlePanMove = useCallback((e) => {
    if (dragging) {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left - pan.x) / zoom;
      const y = (e.clientY - rect.top - pan.y) / zoom;
      setDragging(prev => ({ ...prev, x, y }));
      return;
    }
    if (!isPanning || !panStart.current) return;
    setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
  }, [isPanning, dragging, pan, zoom]);

  const handlePanEnd = useCallback((e) => {
    if (dragging) {
      // Walk up from target to find input port
      let el = e.target;
      let targetId = null;
      while (el && el !== containerRef.current) {
        const port = el.getAttribute && el.getAttribute('data-input-port');
        if (port) { targetId = port; break; }
        el = el.parentElement || el.parentNode;
      }
      if (targetId && targetId !== dragging.sourceId && onConnect) {
        onConnect(dragging.sourceId, targetId);
      }
      setDragging(null);
    }
    setIsPanning(false);
    panStart.current = null;
  }, [dragging, onConnect]);

  const handlePortMouseDown = useCallback((e, sourceId) => {
    e.stopPropagation();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;
    setDragging({ sourceId, x, y });
  }, [pan, zoom]);

  // Fit-to-view on first render
  useEffect(() => {
    if (layout.width === 0 || layout.height === 0) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const scaleX = (rect.width - 48) / layout.width;
    const scaleY = (rect.height - 48) / layout.height;
    const fitZoom = Math.min(scaleX, scaleY, 1.5);
    const fitPanX = (rect.width - layout.width * fitZoom) / 2;
    const fitPanY = (rect.height - layout.height * fitZoom) / 2;
    setZoom(fitZoom);
    setPan({ x: fitPanX, y: fitPanY });
  }, [layout.width, layout.height]);

  const getNodeColor = (node) => {
    const selected = node.id === selectedSceneId;
    if (node.isDeadEnd) return { fill: selected ? '#333333' : 'transparent', stroke: '#666666', text: '#666666', strokeWidth: selected ? 2 : 1 };
    if (node.isUnreachable) return { fill: selected ? '#333333' : 'transparent', stroke: '#444444', text: '#555555', strokeWidth: selected ? 2 : 1 };
    return { fill: selected ? '#333333' : 'transparent', stroke: '#cccccc', text: '#cccccc', strokeWidth: selected ? 2 : 1 };
  };

  const getNodeLabel = (node) => {
    if (node.isStart) return '  START';
    if (node.isEnding) return '  END';
    return '';
  };

  // Source output port position for the drag line
  const dragSource = dragging ? layout.nodes.find(n => n.id === dragging.sourceId) : null;

  const zoomPercent = Math.round(zoom * 100);

  return (
    <div className="story-map-panel">
      <div className="story-map-header">
        <h2>Story Map</h2>
        <div className="map-controls">
          <button className="map-zoom-btn" onClick={() => setZoom(z => Math.max(MIN_ZOOM, z - ZOOM_STEP))}>-</button>
          <span className="map-zoom-label">{zoomPercent}%</span>
          <button className="map-zoom-btn" onClick={() => setZoom(z => Math.min(MAX_ZOOM, z + ZOOM_STEP))}>+</button>
          <button className="map-zoom-btn" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} title="Reset (0)">1:1</button>
          {onAddScene && (
            <button className="map-zoom-btn" onClick={onAddScene} title="Add Scene" style={{ marginLeft: 12, width: 'auto', padding: '0 12px' }}>+ Scene</button>
          )}
        </div>
      </div>
      <div
        ref={containerRef}
        className="story-map-container"
        onMouseDown={handlePanStart}
        onMouseMove={handlePanMove}
        onMouseUp={handlePanEnd}
        onMouseLeave={handlePanEnd}
        style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
      >
        <svg
          ref={svgRef}
          className="story-map-svg"
          style={{
            width: '100%',
            height: '100%',
            overflow: 'visible',
          }}
        >
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* Unreachable separator */}
            {layout.unreachableY && (
              <>
                <line
                  x1={0} y1={layout.unreachableY - 24}
                  x2={layout.width} y2={layout.unreachableY - 24}
                  stroke="#444444" strokeDasharray="6 4"
                />
                <text x={PAD} y={layout.unreachableY - 32} fill="#555555" fontSize="12" fontFamily="'Atkinson Hyperlegible', sans-serif">
                  Unreachable
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
                  <path d={d} fill="none" stroke="#cccccc" strokeWidth="1" opacity="0.4" />
                  <polygon
                    points={`${edge.x2},${edge.y2} ${edge.x2 - 8},${edge.y2 - 4} ${edge.x2 - 8},${edge.y2 + 4}`}
                    fill="#cccccc" opacity="0.5"
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
                stroke="#cccccc"
                strokeWidth="1.5"
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
              const label = getNodeLabel(node);

              return (
                <g key={node.id}>
                  {/* Node body */}
                  <rect
                    x={node.x} y={node.y}
                    width={NODE_W} height={NODE_H}
                    rx={4} ry={4}
                    fill={colors.fill}
                    stroke={colors.stroke}
                    strokeWidth={colors.strokeWidth || 1}
                    style={{ cursor: 'pointer' }}
                    data-node={node.id}
                    onClick={(e) => { e.stopPropagation(); onSelectScene(node.id); }}
                  />
                  <text
                    x={node.x + NODE_W / 2}
                    y={node.y + NODE_H / 2 - (label ? 4 : 0)}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={colors.text}
                    fontSize="13"
                    fontFamily="'Atkinson Hyperlegible', sans-serif"
                    fontWeight="400"
                    pointerEvents="none"
                  >
                    {node.title.length > 20 ? node.title.slice(0, 18) + '...' : node.title}
                  </text>
                  {label && (
                    <text
                      x={node.x + NODE_W / 2}
                      y={node.y + NODE_H / 2 + 12}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#888888"
                      fontSize="9"
                      fontFamily="'Atkinson Hyperlegible', sans-serif"
                      fontWeight="400"
                      letterSpacing="0.1em"
                      pointerEvents="none"
                    >
                      {label}
                    </text>
                  )}

                  {/* Output port (right side) */}
                  {!node.isEnding && (
                    <circle
                      cx={outX} cy={outY} r={PORT_R}
                      fill={dragging?.sourceId === node.id ? '#cccccc' : '#1a1a1a'}
                      stroke="#cccccc"
                      strokeWidth="1"
                      style={{ cursor: 'crosshair' }}
                      data-output-port={node.id}
                      onMouseDown={(e) => handlePortMouseDown(e, node.id)}
                    />
                  )}

                  {/* Input port (left side) */}
                  <circle
                    cx={inX} cy={inY} r={PORT_R}
                    fill={isDropTarget ? '#cccccc' : '#1a1a1a'}
                    stroke={isDropTarget ? '#cccccc' : '#555555'}
                    strokeWidth="1"
                    style={{ cursor: isDropTarget ? 'pointer' : 'default' }}
                    data-input-port={node.id}
                  />
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
};

export default StoryMap;
