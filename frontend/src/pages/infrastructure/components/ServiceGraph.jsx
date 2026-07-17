import React, { useMemo, useState, useRef } from 'react';

const DEFAULT_NODE_LAYOUT = {
  frontend: { x: 40, y: 30, width: 190, height: 110 },
  saas: { x: 290, y: 50, width: 190, height: 110 },
  auth: { x: 560, y: 90, width: 190, height: 110 },
  guest: { x: 130, y: 230, width: 190, height: 110 },
  hotels: { x: 420, y: 250, width: 190, height: 110 },
  reservation: { x: 770, y: 230, width: 190, height: 110 },
  billing: { x: 320, y: 470, width: 190, height: 110 },
  audit: { x: 620, y: 500, width: 190, height: 110 },
  reporting: { x: 950, y: 440, width: 190, height: 110 },
};

const normalizeServiceKey = (value) =>
  String(value || '')
    .replace(/-service$/, '')
    .replace(/\.$/, '')
    .trim();

const getNodeStatus = (svcInfo) => {
  if (!svcInfo) return 'pending';
  if (svcInfo.error) return 'offline';
  if (svcInfo.data) return 'online';
  return 'pending';
};

const getNodeCenter = (node) => ({
  x: node.x + node.width / 2,
  y: node.y + node.height / 2,
});

const buildPath = (source, target) => {
  const src = getNodeCenter(source);
  const tgt = getNodeCenter(target);
  const controlOffset = Math.max(80, Math.abs(tgt.x - src.x) / 2);
  const c1x = src.x + controlOffset;
  const c1y = src.y;
  const c2x = tgt.x - controlOffset;
  const c2y = tgt.y;

  return `M ${src.x} ${src.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${tgt.x} ${tgt.y}`;
};

// Helpers for route filtering/grouping
const isExposedRoute = (r) => {
  if (!r) return false;
  if (r.type && r.type.toLowerCase() === 'internal') return false;
  if (r.path && typeof r.path === 'string' && r.path.startsWith('/')) return true;
  if (r.handler) return true;
  return false;
};

const normalizePath = (p) => {
  if (!p || typeof p !== 'string') return '';
  let s = p.trim().toLowerCase();
  // replace parameter segments like :id or {id} with :param
  s = s.replace(/:\w+/g, ':param').replace(/\{[^}]+\}/g, ':param');
  // collapse multiple slashes
  s = s.replace(/\/+/g, '/');
  // remove trailing slash
  if (s.length > 1 && s.endsWith('/')) s = s.slice(0, -1);
  return s;
};

const routeKey = (r) => normalizePath(r?.path) || (r?.handler || '');

const groupRoutes = (routes = []) => {
  const groups = new Map();
  routes.forEach((r) => {
    const path = r.path || '';
    const normalized = normalizePath(path);
    let key = 'other';
    if (normalized && normalized !== '') {
      const parts = normalized.split('/').filter(Boolean);
      key = parts[0] || 'root';
    } else if (r.handler) {
      key = r.handler.split('.')[0] || 'handler';
    }

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  });

  // Convert to array of {group, routes}
  return Array.from(groups.entries()).map(([group, rs]) => ({ group, routes: rs }));
};

const findSharedRouteKeys = (aRoutes = [], bRoutes = []) => {
  const aKeys = new Set(aRoutes.map(routeKey).filter(Boolean));
  const bKeys = new Set(bRoutes.map(routeKey).filter(Boolean));
  const shared = new Set();
  aKeys.forEach((k) => { if (bKeys.has(k)) shared.add(k); });
  return shared;
};

export default function ServiceGraph({ servicesData, selectedService, onSelect }) {
  // Keep node positions in state so they can be dragged.
  const [nodeLayout, setNodeLayout] = useState(DEFAULT_NODE_LAYOUT);


  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const draggingRef = useRef(null); // { id, startX, startY, origX, origY }
  const [highlightedNodes, setHighlightedNodes] = useState(new Set());
  const [highlightedEdgeKey, setHighlightedEdgeKey] = useState(null);

  // Floating panel state (used for both edge and node details)
  const [panelPos, setPanelPos] = useState({ left: 24, top: 360 });
  const panelDraggingRef = useRef(null); // { startX, startY, origLeft, origTop }
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  const graphData = useMemo(() => {
    const nodes = Object.entries(nodeLayout).map(([svcKey, position]) => {
      const svcInfo = servicesData[svcKey];
      const data = svcInfo?.data;
      const status = getNodeStatus(svcInfo);

      return {
        id: svcKey,
        ...position,
        title: `${svcKey}-service`,
        status,
        routes: data?.routes?.length || 0,
        dependencies: data?.dependencies?.length || 0,
        publishes: data?.events?.publishes?.length || 0,
        consumes: data?.events?.consumes?.length || 0,
      };
    });

    const seenEdges = new Set();
    const edges = [];

    nodes.forEach((node) => {
      const svcInfo = servicesData[node.id];
      const data = svcInfo?.data;

      (data?.dependencies || []).forEach((depName) => {
        const targetKey = normalizeServiceKey(depName);
        if (!nodeLayout[targetKey]) return;

        const edgeKey = `${node.id}->${targetKey}:dependency`;
        if (!seenEdges.has(edgeKey)) {
          // try to detect HTTP "consumed" routes declared by the caller (client)
          const clientData = servicesData[node.id]?.data;
          const serverData = servicesData[targetKey]?.data;

          const clientConsumes = (clientData?.consumes_routes || clientData?.consumesRoutes || clientData?.httpConsumes || clientData?.consumes_http) || [];

          // normalize consumed routes to route-like objects when possible
          const normalizedClientConsumes = (clientConsumes || []).map((c) => (typeof c === 'string' ? { path: c } : c));

          // server exposed routes
          const serverRoutes = serverData?.routes || [];

          // compute shared route keys between server's exposed and client's consumed routes
          const shared = findSharedRouteKeys(serverRoutes, normalizedClientConsumes);

          seenEdges.add(edgeKey);
          edges.push({
            source: node.id,
            target: targetKey,
            type: 'dependency',
            label: depName,
            key: edgeKey,
            sharedRoutes: Array.from(shared),
          });
        }
      });
    });

    const eventMap = new Map();
    nodes.forEach((node) => {
      const svcInfo = servicesData[node.id];
      const data = svcInfo?.data;

      (data?.events?.publishes || []).forEach((eventName) => {
        const key = eventName.trim();
        if (!eventMap.has(key)) eventMap.set(key, []);
        eventMap.get(key).push(node.id);
      });
    });

    eventMap.forEach((publisherNodes, eventName) => {
      publisherNodes.forEach((publisherKey) => {
        nodes.forEach((consumerNode) => {
          const svcInfo = servicesData[consumerNode.id];
          const consumes = svcInfo?.data?.events?.consumes || [];
          if (!consumes.includes(eventName)) return;

          const edgeKey = `${publisherKey}->${consumerNode.id}:${eventName}`;
          if (seenEdges.has(edgeKey)) return;

          seenEdges.add(edgeKey);
          edges.push({
            source: publisherKey,
            target: consumerNode.id,
            type: 'event',
            label: eventName,
            key: edgeKey,
          });
        });
      });
    });

    return { nodes, edges };
  }, [servicesData, nodeLayout]);

  const getEdgeColor = (type) => (type === 'event' ? '#8b5cf6' : '#0f766e');

  // Pointer events for dragging
  const handlePointerDown = (e, nodeId) => {
    e.stopPropagation();
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (!svgRect) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const orig = nodeLayout[nodeId];
    draggingRef.current = { id: nodeId, startX, startY, origX: orig.x, origY: orig.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!draggingRef.current) return;
    const { id, startX, startY, origX, origY } = draggingRef.current;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    setNodeLayout((prev) => ({
      ...prev,
      [id]: { ...prev[id], x: Math.max(8, origX + dx), y: Math.max(8, origY + dy) },
    }));
  };

  const handlePointerUp = (e) => {
    if (draggingRef.current) {
      try {
        e.currentTarget.releasePointerCapture?.(e.pointerId);
      } catch (err) {
        // ignore
      }
    }
    draggingRef.current = null;
  };

  // Panel helpers: map SVG viewBox coords to container pixels and clamp
  const computePanelPosFromView = (viewX, viewY, panelW = 420, panelH = 220) => {
    const svg = svgRef.current;
    const container = containerRef.current;
    if (!svg || !container) return { left: 24, top: 360 };

    const svgRect = svg.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const viewBoxWidth = 1260; // keep in sync with svg viewBox
    const viewBoxHeight = 660;
    const scaleX = svgRect.width / viewBoxWidth;
    const scaleY = svgRect.height / viewBoxHeight;
    const scale = Math.min(scaleX, scaleY);

    const px = svgRect.left + viewX * scale;
    const py = svgRect.top + viewY * scale;

    let left = px - containerRect.left - panelW / 2;
    let top = py - containerRect.top - panelH - 8;

    // clamp to container
    left = Math.max(8, Math.min(left, containerRect.width - panelW - 8));
    top = Math.max(8, Math.min(top, containerRect.height - panelH - 8));

    return { left, top };
  };

  const handlePanelPointerDown = (e) => {
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    panelDraggingRef.current = { startX, startY, origLeft: panelPos.left, origTop: panelPos.top };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handlePanelPointerMove = (e) => {
    if (!panelDraggingRef.current) return;
    const { startX, startY, origLeft, origTop } = panelDraggingRef.current;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    setPanelPos({ left: Math.max(8, origLeft + dx), top: Math.max(8, origTop + dy) });
  };

  const handlePanelPointerUp = (e) => {
    if (panelDraggingRef.current) {
      try { e.currentTarget.releasePointerCapture?.(e.pointerId); } catch (err) {}
    }
    panelDraggingRef.current = null;
  };

  const handlePanelWheel = (e) => {
    e.stopPropagation();
    // vertical move with wheel: invert deltaY
    setPanelPos((p) => ({ left: p.left, top: Math.max(8, p.top + e.deltaY) }));
  };

  const [edgeDetails, setEdgeDetails] = useState(null);
  const [nodeDetails, setNodeDetails] = useState(null);

  // When an edge is clicked, compute exposed routes, group them and position the panel
  const handleEdgeClick = (e, edge) => {
    e.stopPropagation();
    setHighlightedEdgeKey(edge.key);
    setHighlightedNodes(new Set([edge.source, edge.target]));

    // For event edges the existing logic (publisher -> consumer) is fine.
    // For dependency (HTTP) edges, prefer to match server's exposed routes with client's declared consumed routes
    let sourceRoutesRaw = servicesData[edge.source]?.data?.routes || [];
    let targetRoutesRaw = servicesData[edge.target]?.data?.routes || [];
    let sourceExposed = sourceRoutesRaw.filter(isExposedRoute);
    let targetExposed = targetRoutesRaw.filter(isExposedRoute);
    let sharedKeys = new Set();

    if (edge.type === 'dependency') {
      // caller is edge.source (client) and callee is edge.target (server)
      const clientData = servicesData[edge.source]?.data || {};
      const serverData = servicesData[edge.target]?.data || {};

      const clientConsumesRaw = (clientData.consumes_routes || clientData.consumesRoutes || clientData.httpConsumes || clientData.consumes_http) || [];
      const normalizedClientConsumes = (clientConsumesRaw || []).map((c) => (typeof c === 'string' ? { path: c } : c));

      // server exposed routes
      const serverExposed = (serverData.routes || []).filter(isExposedRoute);

      // compute intersection: server routes ∩ client consumed routes
      sharedKeys = findSharedRouteKeys(serverExposed, normalizedClientConsumes);

      // present on the left side the client's consumed routes, and on the right side the server's exposed routes
      sourceExposed = normalizedClientConsumes.filter(Boolean);
      targetExposed = serverExposed;
    } else {
      // default: show exposed routes for both sides (events case)
      sourceExposed = sourceRoutesRaw.filter(isExposedRoute);
      targetExposed = targetRoutesRaw.filter(isExposedRoute);
      sharedKeys = findSharedRouteKeys(sourceExposed, targetExposed);
    }

    const sourceGroups = groupRoutes(sourceExposed).map((g) => ({
      ...g,
      routes: g.routes.map((r) => ({ ...r, _key: routeKey(r), _shared: sharedKeys.has(routeKey(r)) })),
    }));

    const targetGroups = groupRoutes(targetExposed).map((g) => ({
      ...g,
      routes: g.routes.map((r) => ({ ...r, _key: routeKey(r), _shared: sharedKeys.has(routeKey(r)) })),
    }));

    // compute mid point for panel positioning
    const sourceNode = nodeLayout[edge.source];
    const targetNode = nodeLayout[edge.target];
    const midX = (sourceNode.x + sourceNode.width / 2 + targetNode.x + targetNode.width / 2) / 2;
    const midY = (sourceNode.y + targetNode.y) / 2 - 8;
    const pos = computePanelPosFromView(midX, midY);

    setPanelPos(pos);
    setEdgeDetails({ edge, sourceGroups, targetGroups, sharedKeys });
    setNodeDetails(null);

    onSelect(edge.source);
  };

  // When a node is clicked, show its routes grouped (all exposed)
  const handleNodeClick = (e, node) => {
    e.stopPropagation();
    onSelect(node.id);

    const rawRoutes = servicesData[node.id]?.data?.routes || [];
    const exposed = rawRoutes.filter(isExposedRoute);
    const groups = groupRoutes(exposed).map((g) => ({
      ...g,
      routes: g.routes.map((r) => ({ ...r, _key: routeKey(r) })),
    }));

    // position near node center
    const center = getNodeCenter(node);
    const pos = computePanelPosFromView(center.x, center.y + 10);

    setPanelPos(pos);
    setNodeDetails({ node: node.id, groups });
    setEdgeDetails(null);
    setHighlightedNodes(new Set([node.id]));
  };

  const handleBackgroundClick = () => {
    setHighlightedNodes(new Set());
    setHighlightedEdgeKey(null);
    setEdgeDetails(null);
    setNodeDetails(null);
  };

  return (
    <div ref={containerRef} className="rounded-[28px] border border-surface-200 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-surface-100 bg-surface-50 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-bold text-surface-900 text-sm">Grafo de microservicios</h2>
          <p className="text-[11px] text-surface-500 mt-1">
            Dependencias HTTP + eventos RabbitMQ. Arrastra nodos para reorganizar y haz click en una conexión para resaltar los servicios involucrados.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-[10px] font-semibold text-surface-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            HTTP
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-violet-500"></span>
            Evento
          </span>
        </div>
      </div>

      <div className="p-3 bg-slate-950/95 relative">
        <svg
          ref={svgRef}
          viewBox="0 0 1260 660"
          className="w-full h-auto min-h-[520px]"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onClick={handleBackgroundClick}
        >
          <defs>
            <marker id="arrow-dependency" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
              <path d="M0,0 L0,6 L9,3 z" fill="#0f766e" />
            </marker>
            <marker id="arrow-event" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
              <path d="M0,0 L0,6 L9,3 z" fill="#8b5cf6" />
            </marker>
          </defs>

          {/* Edges */}
          {graphData.edges.map((edge, idx) => {
            const source = graphData.nodes.find((node) => node.id === edge.source);
            const target = graphData.nodes.find((node) => node.id === edge.target);
            if (!source || !target) return null;

            const isDashed = edge.type === 'event';
            const path = buildPath(source, target);
            const midX = (source.x + source.width / 2 + target.x + target.width / 2) / 2;
            const midY = (source.y + target.y) / 2 - 8;

            const isHighlighted = highlightedEdgeKey === edge.key;
            const hasShared = Array.isArray(edge.sharedRoutes) && edge.sharedRoutes.length > 0;
            const lineColor = isHighlighted ? '#f59e0b' : hasShared ? '#f59e0b' : getEdgeColor(edge.type);

            return (
              <g
                key={`${edge.source}-${edge.target}-${edge.label}-${idx}`}
                onClick={(e) => handleEdgeClick(e, edge)}
                className="cursor-pointer"
              >
                <path
                  d={path}
                  fill="none"
                  stroke={lineColor}
                  strokeWidth={isHighlighted ? 4 : isDashed ? 2.2 : 2.6}
                  strokeDasharray={isDashed ? '7 6' : '0'}
                  markerEnd={`url(#${edge.type === 'event' ? 'arrow-event' : 'arrow-dependency'})`}
                  opacity={isHighlighted ? 1 : 0.95}
                />
                <text
                  x={midX}
                  y={midY}
                  fill="#cbd5e1"
                  fontSize="10"
                  fontFamily="monospace"
                  textAnchor="middle"
                  className="select-none"
                >
                  {edge.label}{hasShared ? ` · ${edge.sharedRoutes.length} compartida${edge.sharedRoutes.length > 1 ? 's' : ''}` : ''}
                </text>
              </g>
            );
          })}

          {/* Nodes */}
          {graphData.nodes.map((node) => {
            const isSelected = selectedService === node.id;
            const isHighlighted = highlightedNodes.has(node.id);
            const nodeFill = node.status === 'online'
              ? '#0f172a'
              : node.status === 'offline'
                ? '#3f3f46'
                : '#1e293b';

            return (
              <g
                key={node.id}
                onClick={(e) => handleNodeClick(e, node)}
                onPointerDown={(e) => handlePointerDown(e, node.id)}
                className="cursor-move"
              >
                <rect
                  x={node.x}
                  y={node.y}
                  width={node.width}
                  height={node.height}
                  rx="18"
                  fill={isSelected ? '#1d4ed8' : isHighlighted ? '#075985' : nodeFill}
                  stroke={isSelected ? '#60a5fa' : '#334155'}
                  strokeWidth={isSelected ? 2.5 : 1.2}
                  opacity={0.97}
                />
                <text
                  x={node.x + 18}
                  y={node.y + 24}
                  fill="#f8fafc"
                  fontSize="12"
                  fontWeight="700"
                >
                  {node.title}
                </text>
                <text
                  x={node.x + 18}
                  y={node.y + 44}
                  fill="#93c5fd"
                  fontSize="11"
                  fontWeight="600"
                >
                  {node.routes} rutas • {node.dependencies} deps
                </text>
                <text
                  x={node.x + 18}
                  y={node.y + 63}
                  fill="#c4b5fd"
                  fontSize="11"
                  fontWeight="600"
                >
                  {node.publishes} publica • {node.consumes} consume
                </text>
                <text
                  x={node.x + 18}
                  y={node.y + 84}
                  fill={node.status === 'online' ? '#34d399' : '#fca5a5'}
                  fontSize="11"
                  fontWeight="700"
                >
                  {node.status === 'online' ? 'ONLINE' : node.status === 'offline' ? 'OFFLINE' : 'PENDING'}
                </text>
              </g>
            );
          })}
        </svg>

          {/* Floating details panel for edge OR node (movable + wheel-scroll) */}
          {(edgeDetails || nodeDetails) && (
            <div
              className="absolute z-50"
              style={{ left: `${panelPos.left}px`, top: `${panelPos.top}px`, width: 420 }}
              onPointerMove={(e) => handlePanelPointerMove(e)}
              onPointerUp={(e) => handlePanelPointerUp(e)}
              onWheel={(e) => handlePanelWheel(e)}
            >
              <div className="bg-slate-900/95 text-white rounded-lg p-0 border border-white/5 text-sm shadow-lg overflow-hidden">
                <div
                  className="flex items-center justify-between gap-3 px-3 py-2 bg-slate-800 cursor-grab select-none"
                  onPointerDown={(e) => handlePanelPointerDown(e)}
                >
                  <div className="text-sm font-semibold">
                    {edgeDetails ? `Conexión: ${edgeDetails.edge.label}` : `Servicio: ${nodeDetails.node}`}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-slate-400 mr-2">Arrastra o usa la rueda para mover</div>
                    <button
                      onClick={() => {
                        setEdgeDetails(null);
                        setNodeDetails(null);
                        setHighlightedEdgeKey(null);
                        setHighlightedNodes(new Set());
                        setExpandedGroups(new Set());
                      }}
                      className="text-xs px-2 py-1 bg-white/5 rounded"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>

                <div className="p-3 max-h-[260px] overflow-auto">
                  {edgeDetails && (
                    <div>
                      <div className="text-xs text-slate-300 mb-2">{edgeDetails.edge.source} → {edgeDetails.edge.target} ({edgeDetails.edge.type})</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {['source', 'target'].map((side) => {
                          const groups = side === 'source' ? edgeDetails.sourceGroups : edgeDetails.targetGroups;
                          return (
                            <div key={side}>
                              <div className="font-semibold text-slate-200 mb-2">Rutas / Funciones de {side === 'source' ? edgeDetails.edge.source : edgeDetails.edge.target}</div>
                              {groups.length === 0 && <div className="text-slate-400 text-xs">(No hay rutas descubiertas)</div>}
                              {groups.map((g) => {
                                const groupId = `${side}:${g.group}`;
                                const isOpen = expandedGroups.has(groupId);
                                return (
                                  <div key={groupId} className="mb-2">
                                    <button
                                      onClick={() => {
                                        const s = new Set(expandedGroups);
                                        if (s.has(groupId)) s.delete(groupId); else s.add(groupId);
                                        setExpandedGroups(s);
                                      }}
                                      className="w-full flex items-center justify-between bg-white/3 px-2 py-1 rounded"
                                    >
                                      <div className="text-xs font-medium">{g.group}</div>
                                      <div className="text-xs text-slate-300">{g.routes.length}</div>
                                    </button>
                                    {isOpen && (
                                      <ul className="mt-2 ml-2 text-xs space-y-1">
                                        {g.routes.map((r, i) => (
                                          <li key={`${groupId}-r-${i}`} className="flex items-start gap-2">
                                            <div className="text-xs text-slate-400 w-16">{(r.methods||[]).join(', ')}</div>
                                            <div className="font-mono text-slate-200 break-words">{r.path || r.handler || '(sin path)'}</div>
                                            {r._shared && <div className="ml-2 text-[11px] bg-amber-600 text-black px-1 rounded">Compartida</div>}
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {nodeDetails && (
                    <div>
                      <div className="text-xs text-slate-300 mb-2">Rutas expuestas de {nodeDetails.node}</div>
                      {nodeDetails.groups.length === 0 && <div className="text-slate-400 text-xs">(No hay rutas descubiertas)</div>}
                      {nodeDetails.groups.map((g) => {
                        const groupId = `node:${g.group}`;
                        const isOpen = expandedGroups.has(groupId);
                        return (
                          <div key={groupId} className="mb-2">
                            <button
                              onClick={() => {
                                const s = new Set(expandedGroups);
                                if (s.has(groupId)) s.delete(groupId); else s.add(groupId);
                                setExpandedGroups(s);
                              }}
                              className="w-full flex items-center justify-between bg-white/3 px-2 py-1 rounded"
                            >
                              <div className="text-xs font-medium">{g.group}</div>
                              <div className="text-xs text-slate-300">{g.routes.length}</div>
                            </button>
                            {isOpen && (
                              <ul className="mt-2 ml-2 text-xs space-y-1">
                                {g.routes.map((r, i) => (
                                  <li key={`${groupId}-r-${i}`} className="flex items-start gap-2">
                                    <div className="text-xs text-slate-400 w-16">{(r.methods||[]).join(', ')}</div>
                                    <div className="font-mono text-slate-200 break-words">{r.path || r.handler || '(sin path)'}</div>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
      </div>
    </div>
  );
}
