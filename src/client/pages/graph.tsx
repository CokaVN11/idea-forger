import { useMemo } from "react";
import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { go } from "../lib/api";
import { useApp, useResource } from "../lib/context";
import {
  Empty,
  Heading,
  ResourceState,
  SectionTabs,
} from "../components/shared";

interface GraphData {
  nodes: { id: number; title: string; kind: string }[];
  links: { from_id: number; to_id: number; reason: string }[];
  suggested: { from_id: number; to_id: number; score: number }[];
}

// Small force simulation: repulsion between all nodes, springs along links.
function layout(
  ids: number[],
  links: { from_id: number; to_id: number }[],
) {
  const pos = new Map(
    ids.map((id, i) => {
      const a = (i / ids.length) * Math.PI * 2;
      return [id, { x: Math.cos(a) * 300, y: Math.sin(a) * 300 }];
    }),
  );
  for (let step = 0; step < 250; step++) {
    const force = new Map(ids.map((id) => [id, { x: 0, y: 0 }]));
    for (const a of ids)
      for (const b of ids) {
        if (a >= b) continue;
        const p = pos.get(a)!;
        const q = pos.get(b)!;
        const dx = p.x - q.x || 0.1;
        const dy = p.y - q.y || 0.1;
        const d2 = Math.max(dx * dx + dy * dy, 100);
        const f = 40000 / d2;
        const d = Math.sqrt(d2);
        force.get(a)!.x += (dx / d) * f;
        force.get(a)!.y += (dy / d) * f;
        force.get(b)!.x -= (dx / d) * f;
        force.get(b)!.y -= (dy / d) * f;
      }
    for (const l of links) {
      const p = pos.get(l.from_id);
      const q = pos.get(l.to_id);
      if (!p || !q) continue;
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = (d - 180) * 0.05;
      force.get(l.from_id)!.x += (dx / d) * f;
      force.get(l.from_id)!.y += (dy / d) * f;
      force.get(l.to_id)!.x -= (dx / d) * f;
      force.get(l.to_id)!.y -= (dy / d) * f;
    }
    const cool = 1 - step / 250;
    for (const id of ids) {
      const p = pos.get(id)!;
      const f = force.get(id)!;
      p.x += Math.max(-30, Math.min(30, f.x)) * cool;
      p.y += Math.max(-30, Math.min(30, f.y)) * cool;
    }
  }
  return pos;
}

export function Graph() {
  const { t, kindLabel } = useApp();
  const { data, error } = useResource<GraphData>("/graph");
  const { nodes, edges } = useMemo(() => {
    if (!data) return { nodes: [] as Node[], edges: [] as Edge[] };
    const known = new Set(data.nodes.map((n) => n.id));
    const links = data.links.filter(
      (l) => known.has(l.from_id) && known.has(l.to_id),
    );
    const suggested = data.suggested.filter(
      (l) => known.has(l.from_id) && known.has(l.to_id),
    );
    const linked = new Set(
      [...links, ...suggested].flatMap((l) => [l.from_id, l.to_id]),
    );
    const shown = data.nodes.filter((n) => linked.has(n.id));
    const pos = layout(
      shown.map((n) => n.id),
      [...links, ...suggested],
    );
    return {
      nodes: shown.map<Node>((n) => ({
        id: String(n.id),
        position: pos.get(n.id)!,
        data: { label: `${n.title || "—"} · ${kindLabel(n.kind)}` },
        style: {
          width: 160,
          fontSize: 12,
          background: "var(--card)",
          color: "var(--foreground)",
          border: "1px solid var(--border)",
          borderRadius: 12,
        },
      })),
      edges: [
        ...suggested.map<Edge>((l) => ({
          id: `ai-${l.from_id}-${l.to_id}`,
          source: String(l.from_id),
          target: String(l.to_id),
          label: `AI ${Math.round(l.score * 100)}%`,
          labelStyle: { fontSize: 10 },
          style: { strokeDasharray: "6 4", opacity: 0.7 },
        })),
        ...links.map<Edge>((l) => ({
          id: `${l.from_id}-${l.to_id}`,
          source: String(l.from_id),
          target: String(l.to_id),
          label: l.reason || undefined,
          labelStyle: { fontSize: 10 },
          markerEnd: { type: MarkerType.ArrowClosed },
        })),
      ],
    };
  }, [data, kindLabel]);
  return (
    <>
      <Heading title={t("library")} subtitle={t("graph_sub")} />
      <SectionTabs active="graph" group="connect" />
      <p className="small muted">{t("graph_legend")}</p>
      {!data ? (
        <ResourceState error={error} />
      ) : !nodes.length ? (
        <Empty>{t("graph_empty")}</Empty>
      ) : (
        <div style={{ height: "70vh" }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodesConnectable={false}
            colorMode="system"
            fitView
            onNodeClick={(_, node) => go(`/note/${node.id}`)}
          >
            <Background />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
      )}
    </>
  );
}
