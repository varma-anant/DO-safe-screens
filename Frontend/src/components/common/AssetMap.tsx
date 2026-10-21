import * as React from 'react'
import { ReactFlow, Background, Controls, Handle, Position, MarkerType, type Connection, type Edge, type Node, type NodeProps } from '@xyflow/react'
import { Database, Globe, GitBranch, KeyRound, Network, Server, Box, Cloud, AppWindow, Trash2, Wand2 } from 'lucide-react'
import type { Asset, AssetLink } from '@/types'
import { assetLabel } from '@/utils/plain'
import { plural } from '@/utils/format'
import { cn } from '@/utils/format'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/input'
import { deriveLinks } from '@/data/seed/projects'

const RELATIONS: AssetLink['relation'][] = ['routes to', 'calls', 'hosts', 'stores data in', 'authenticates via', 'deploys to']

const LAYER: Record<string, number> = {
  'network-device': 0, 'api-gateway': 0, 'web-application': 0, 'saas-application': 0,
  container: 1, server: 1, 'serverless-function': 1, 'kubernetes-cluster': 1, endpoint: 1,
  database: 2, 'cloud-storage': 2,
  'identity-provider': 3, 'code-repository': 3,
}
const LAYER_LABEL = ['How people get in', 'Where the work happens', 'Where data lives', 'Sign-in & code']

const ICON: Record<string, React.ReactNode> = {
  'network-device': <Network />, 'api-gateway': <Globe />, 'web-application': <AppWindow />, 'saas-application': <Cloud />,
  container: <Box />, server: <Server />, 'serverless-function': <Box />, 'kubernetes-cluster': <Box />, endpoint: <Server />,
  database: <Database />, 'cloud-storage': <Database />, 'identity-provider': <KeyRound />, 'code-repository': <GitBranch />,
}

function AssetNode({ data }: { data: { asset: Asset; findings: number; selected: boolean } }) {
  const a = data.asset
  return (
    <div className={cn('w-48 rounded-xl border bg-white px-3 py-2 shadow-sm', data.selected ? 'border-primary ring-2 ring-primary/20' : a.internetExposed ? 'border-orange-300' : 'border-border-strong')}>
      <Handle type="target" position={Position.Left} className="!size-2.5 !bg-primary" />
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-subtle [&_svg]:size-3.5 [&_svg]:text-primary">
        {ICON[a.type]} {assetLabel(a.type)}
      </div>
      <div className="mt-0.5 truncate text-[13px] font-medium text-fg">{a.name}</div>
      <div className="flex items-center justify-between text-[10.5px] text-muted">
        <span className="truncate">{a.internetExposed ? 'Internet-facing' : a.environment}</span>
        {data.findings > 0 && <span className="rounded bg-red-50 px-1 font-semibold text-red-700">{data.findings} open</span>}
      </div>
      <Handle type="source" position={Position.Right} className="!size-2.5 !bg-primary" />
    </div>
  )
}
function LayerLabel({ data }: NodeProps) {
  return <div className="pointer-events-none text-[10.5px] font-semibold uppercase tracking-wide text-subtle">{String(data.label)}</div>
}

const nodeTypes = { asset: AssetNode, layer: LayerLabel }

export function AssetMap({ assets, links, editable, onChange, openFindings = {}, height = 460 }: { assets: Asset[]; links: AssetLink[]; editable?: boolean; onChange?: (links: AssetLink[]) => void; openFindings?: Record<string, number>; height?: number }) {
  const [relation, setRelation] = React.useState<AssetLink['relation']>('calls')
  const [selEdge, setSelEdge] = React.useState<string | null>(null)
  const [selNode, setSelNode] = React.useState<string | null>(null)
  const nodes: Node[] = React.useMemo(() => {
    // Long layers wrap into extra sub-columns so the map stays legible when fitted.
    const MAX_ROWS = 6
    const count: Record<number, number> = {}
    for (const a of assets) count[LAYER[a.type] ?? 1] = (count[LAYER[a.type] ?? 1] ?? 0) + 1
    const layerX: number[] = []
    let x = 0
    for (let l = 0; l < LAYER_LABEL.length; l++) {
      layerX[l] = x
      x += Math.max(1, Math.ceil((count[l] ?? 0) / MAX_ROWS)) * 200 + 40
    }
    const labels: Node[] = LAYER_LABEL.map((label, l) => ({ id: `layer-${l}`, type: 'layer', position: { x: layerX[l], y: 0 }, data: { label }, draggable: false, selectable: false, connectable: false }))
    const idx: Record<number, number> = {}
    return [
      ...labels,
      ...assets.map((a) => {
        const layer = LAYER[a.type] ?? 1
        const i = (idx[layer] = (idx[layer] ?? -1) + 1)
        return { id: a.id, type: 'asset', position: { x: layerX[layer] + Math.floor(i / MAX_ROWS) * 200, y: (i % MAX_ROWS) * 92 + 36 }, data: { asset: a, findings: openFindings[a.id] ?? 0, selected: selNode === a.id } }
      }),
    ]
  }, [assets, openFindings, selNode])
  const edges: Edge[] = links.map((l) => ({ id: l.id, source: l.sourceAssetId, target: l.targetAssetId, label: l.relation, selected: selEdge === l.id, style: { stroke: selEdge === l.id ? '#6b47f5' : '#b9b9c6', strokeWidth: selEdge === l.id ? 2.5 : 1.6 }, labelStyle: { fill: '#55566a', fontSize: 10.5 }, labelBgStyle: { fill: '#ffffff' }, markerEnd: { type: MarkerType.ArrowClosed, color: selEdge === l.id ? '#6b47f5' : '#b9b9c6' } }))
  const onConnect = (c: Connection) => {
    if (!editable || !c.source || !c.target || c.source === c.target) return
    if (links.some((l) => l.sourceAssetId === c.source && l.targetAssetId === c.target)) return
    onChange?.([...links, { id: `NEW-${Date.now()}`, sourceAssetId: c.source, targetAssetId: c.target, relation }])
  }
  const linkedIds = new Set(links.flatMap((l) => [l.sourceAssetId, l.targetAssetId]))
  const unmapped = assets.filter((a) => !linkedIds.has(a.id))
  const selLink = links.find((l) => l.id === selEdge)
  return (
    <div className="space-y-3">
      {editable && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs">
          <span className="text-muted">To connect two parts, drag from the dot on the right of one to the other. Label new connections as</span>
          <NativeSelect value={relation} onChange={(e) => setRelation(e.target.value as AssetLink['relation'])} className="h-8 w-40 text-xs" aria-label="Relation for new links">
            {RELATIONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </NativeSelect>
          <span className="mx-1 h-4 w-px bg-border" />
          <Button size="xs" variant="secondary" onClick={() => onChange?.(deriveLinks(assets, `SUG-${Date.now()}`))}>
            <Wand2 /> Suggest connections
          </Button>
          {selLink && (
            <>
              <NativeSelect value={selLink.relation} onChange={(e) => onChange?.(links.map((l) => (l.id === selLink.id ? { ...l, relation: e.target.value as AssetLink['relation'] } : l)))} className="h-8 w-40 text-xs" aria-label="Relation of selected link">
                {RELATIONS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </NativeSelect>
              <Button size="xs" variant="ghost" onClick={() => { onChange?.(links.filter((l) => l.id !== selLink.id)); setSelEdge(null) }}>
                <Trash2 /> Remove link
              </Button>
            </>
          )}
        </div>
      )}
      <div className="relative overflow-hidden rounded-xl border border-border bg-[#fbfbfd]" style={{ height }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.08 }}
          onConnect={onConnect}
          nodesConnectable={!!editable}
          nodesDraggable
          onEdgeClick={(_, e) => setSelEdge(e.id)}
          onNodeClick={(_, n) => n.type === 'asset' && setSelNode(n.id === selNode ? null : n.id)}
          onPaneClick={() => { setSelEdge(null); setSelNode(null) }}
          deleteKeyCode={null}
        >
          <Background color="#e6e6ee" gap={18} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-muted">
        <span>{plural(assets.length, 'part')} · {plural(links.length, 'connection')}</span>
        {unmapped.length > 0 ? <span className="text-amber-700">{unmapped.length} not connected yet: {unmapped.map((a) => a.name).join(', ')}</span> : <span className="text-emerald-700">Every part is connected</span>}
      </div>
    </div>
  )
}
