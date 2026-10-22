import * as React from 'react'
import { useParams } from 'react-router'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Ticket } from '@/types'
import { useDbStore } from '@/stores/db'
import { scopeCollection } from '@/hooks/scope'
import { visibleProjectIds } from '@/utils/permissions'
import { Section, KpiCard } from '@/components/common/layout'
import { BarList, AXIS, GRID, ChartTooltip, CATEGORICAL } from '@/components/common/charts'
import { NativeSelect } from '@/components/ui/input'
import { TicketsTable } from '@/modules/operations'
import { TICKET_STATUS } from '@/utils/labels'

export function TicketDashboard({ tickets }: { tickets: Ticket[] }) {
  const { id } = useParams()
  const db = useDbStore(s => s.db)
  const [projectId, setProjectId] = React.useState('all')
  const [status, setStatus] = React.useState('all')
  const [priority, setPriority] = React.useState('all')
  const projects = db.projects.filter(p => visibleProjectIds(db, db.settings.currentUserId).includes(p.id))
  const projectTickets = (pid: string) => scopeCollection('tickets', tickets, db, new Set(db.services.filter(a => a.projectId === pid).map(a => a.id)))
  const scoped = !id && projectId !== 'all' ? projectTickets(projectId) : tickets
  const filtered = scoped.filter(t => (status === 'all' || t.status === status || (status === 'overdue' && !['done','cancelled'].includes(t.status) && new Date(t.dueDate).getTime() < Date.now())) && (priority === 'all' || t.priority === priority))
  const newest = Math.max(Date.now(), ...scoped.map(t => new Date(t.createdAt).getTime()))
  const trend = Array.from({length:8},(_,i) => {
    const end = newest - (7-i)*7*86400000
    const start = end-7*86400000
    return {week: new Date(start).toLocaleDateString('en',{month:'short',day:'numeric'}),created:scoped.filter(t=>new Date(t.createdAt).getTime()>start && new Date(t.createdAt).getTime()<=end).length}
  })
  return <div className="space-y-5">
    <div className="flex flex-wrap items-end gap-3">
      {!id && <label className="text-xs text-muted">Project<NativeSelect className="mt-1" value={projectId} onChange={e=>setProjectId(e.target.value)} aria-label="Filter tickets by project"><option value="all">All authorized projects</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</NativeSelect></label>}
      <label className="text-xs text-muted">Status<NativeSelect className="mt-1" value={status} onChange={e=>setStatus(e.target.value)} aria-label="Filter tickets by status"><option value="all">All statuses</option>{Object.entries(TICKET_STATUS).map(([key,v])=><option key={key} value={key}>{v.label}</option>)}<option value="overdue">Overdue</option></NativeSelect></label>
      <label className="text-xs text-muted">Priority<NativeSelect className="mt-1" value={priority} onChange={e=>setPriority(e.target.value)} aria-label="Filter tickets by priority"><option value="all">All priorities</option>{['P1','P2','P3','P4'].map(p=><option key={p}>{p}</option>)}</NativeSelect></label>
      <button className="px-2 py-2 text-sm text-primary" onClick={()=>{setStatus('all');setPriority('all');setProjectId('all')}}>Reset filters</button>
    </div>
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <KpiCard label="Open" value={scoped.filter(t=>t.status==='open').length} onClick={()=>setStatus('open')} />
      <KpiCard label="In progress" value={scoped.filter(t=>t.status==='in_progress').length} onClick={()=>setStatus('in_progress')} />
      <KpiCard label="Resolved" value={scoped.filter(t=>t.status==='done').length} tone="green" onClick={()=>setStatus('done')} />
      <KpiCard label="Overdue" value={scoped.filter(t=>!['done','cancelled'].includes(t.status)&&new Date(t.dueDate).getTime()<Date.now()).length} tone="red" onClick={()=>setStatus('overdue')} />
    </div>
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
      <Section title="By status"><BarList items={Object.entries(TICKET_STATUS).map(([key,v],i)=>({label:v.label,value:scoped.filter(t=>t.status===key).length,color:CATEGORICAL[i%CATEGORICAL.length],onClick:()=>setStatus(key)}))} /></Section>
      <Section title="By priority"><BarList items={['P1','P2','P3','P4'].map((p,i)=>({label:p,value:scoped.filter(t=>t.priority===p).length,color:CATEGORICAL[i],onClick:()=>setPriority(p)}))} /></Section>
      <Section title="By project" description="Shared tickets can appear in multiple projects."><BarList items={projects.filter(p=>!id||p.id===id).map(p=>({label:p.name,value:projectTickets(p.id).length,onClick:!id?()=>setProjectId(p.id):undefined}))} /></Section>
      <Section title="Ticket creation trend" description="Tickets created per week · last 8 weeks"><div className="h-48" role="img" aria-label={trend.map(w=>`${w.week}: ${w.created} tickets`).join('; ')}><ResponsiveContainer width="100%" height="100%"><AreaChart data={trend}><CartesianGrid {...GRID}/><XAxis dataKey="week" {...AXIS} interval={3}/><YAxis {...AXIS} allowDecimals={false} width={25}/><Tooltip content={<ChartTooltip/>}/><Area dataKey="created" name="Created" stroke={CATEGORICAL[0]} fill="#ede9fe" /></AreaChart></ResponsiveContainer></div></Section>
    </div>
    <Section title="Tickets" description={`${filtered.length} matching tickets. Select a ticket to review, assign or resolve it.`}>
      <TicketsTable key={`${id || projectId}-${status}-${priority}`} tickets={filtered} tableId={`enterprise-tickets-${id || 'global'}`} views={[{id:'open',label:'All matching',filters:[]},{id:'critical',label:'Critical',filters:[{id:'priority',value:['P1']}]}]} />
    </Section>
  </div>
}
