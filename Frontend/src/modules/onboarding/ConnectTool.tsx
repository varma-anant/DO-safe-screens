import * as React from 'react'
import { Link } from 'react-router'
import { Ban, CheckCircle2, Clock, Eye, KeyRound, Loader2, Lock, PencilOff, ShieldCheck, Unplug, UserCheck } from 'lucide-react'
import type { Integration } from '@/types'
import { useAction, useCan, useSettings } from '@/hooks/queries'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import * as api from '@/services/api'
import { cn } from '@/utils/format'
import { TOOL_ACCESS } from '@/utils/plain'

const AUTH_STEPS = (vendor: string) => [`Opening ${vendor} sign-in`, 'Approving read-only access', 'Checking the connection works']

export const toolName = (i: Integration) => (i.id === 'INT-ASM' ? 'Outside-in monitor (built in)' : i.vendor.replace(' (built-in, simulated)', ''))

/**
 * Review exactly what a tool connection allows before authorizing it — read, change, never, scope,
 * data handling and how to disconnect — then run a visible (simulated) authorization.
 */
export function ConnectToolDialog({ integration, appName, parts, open, onOpenChange, onConnected }: { integration: Integration | null; appName: string; parts: string[]; open: boolean; onOpenChange: (v: boolean) => void; onConnected?: (id: string) => void }) {
  const settings = useSettings()
  const canConnect = useCan('manage_integrations')
  const { run } = useAction()
  const [phase, setPhase] = React.useState<'review' | 'authorizing' | 'done'>('review')
  const [stepIdx, setStepIdx] = React.useState(0)
  const [scope, setScope] = React.useState<'app' | 'org'>('app')
  React.useEffect(() => {
    if (open) {
      setPhase(integration?.status === 'connected' ? 'done' : 'review')
      setStepIdx(0)
      setScope('app')
    }
  }, [open, integration?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!integration) return null
  const access = TOOL_ACCESS[integration.id]
  const name = toolName(integration)
  const steps = AUTH_STEPS(name)
  const scopeText = scope === 'app' ? `Only the parts of ${appName}` : `All of ${settings.orgName}`

  const authorize = async () => {
    setPhase('authorizing')
    setStepIdx(0)
    const timers = [setTimeout(() => setStepIdx(1), 700), setTimeout(() => setStepIdx(2), 1400)]
    const ok = await run(async () => {
      await api.quickConnectIntegration(integration.id, scopeText)
      return true
    })
    timers.forEach(clearTimeout)
    if (ok) {
      setStepIdx(3)
      setPhase('done')
      onConnected?.(integration.id)
    } else setPhase('review')
  }

  return (
    <Dialog open={open} onOpenChange={(v) => phase !== 'authorizing' && onOpenChange(v)}>
      <DialogContent title={phase === 'done' ? `${name} is connected` : `Connect ${name}`} description={phase === 'review' ? access?.does : undefined}>
        {phase === 'review' && (
          <div className="space-y-4 text-[13px]">
            <AccessBlock icon={<Eye />} tone="sky" title="What DO SAFE will read" items={access?.reads ?? ['Security results from this tool']} />
            <AccessBlock icon={<PencilOff />} tone="emerald" title="What DO SAFE can change" items={['Nothing. This is read-only access — DO SAFE can look, but never change, delete or create anything.']} />
            <AccessBlock icon={<Ban />} tone="slate" title="What DO SAFE never touches" items={access?.never ?? ['Your files, emails or passwords']} />
            <div>
              <div className="mb-1.5 text-xs font-semibold">Which parts can it see?</div>
              <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Access scope">
                {([['app', `Only ${appName}`, `${parts.length} ${parts.length === 1 ? 'part' : 'parts'} — recommended`], ['org', 'Whole organization', 'Useful when you protect more apps later']] as const).map(([k, t, d]) => (
                  <button key={k} type="button" role="radio" aria-checked={scope === k} onClick={() => setScope(k)} className={cn('min-h-11 rounded-lg border px-3 py-2 text-left cursor-pointer', scope === k ? 'border-primary bg-primary-soft' : 'border-border hover:border-border-strong')}>
                    <div className="text-[13px] font-medium">{t}</div>
                    <div className="text-[11.5px] text-muted">{d}</div>
                  </button>
                ))}
              </div>
            </div>
            <ul className="grid gap-2 rounded-lg bg-surface-2 p-3 text-xs text-muted sm:grid-cols-2">
              <li className="flex gap-2"><Lock className="mt-0.5 size-3.5 shrink-0 text-primary" /> Results are encrypted in transit and at rest.</li>
              <li className="flex gap-2"><Clock className="mt-0.5 size-3.5 shrink-0 text-primary" /> Results are kept for 12 months, then deleted.</li>
              <li className="flex gap-2"><Unplug className="mt-0.5 size-3.5 shrink-0 text-primary" /> Disconnect anytime in Integrations — access stops immediately.</li>
              <li className="flex gap-2"><UserCheck className="mt-0.5 size-3.5 shrink-0 text-primary" /> Who approves: {access?.approver ?? 'Your administrator'} · about {access?.minutes ?? 2} min.</li>
            </ul>
            {!canConnect && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                Only an administrator can connect tools. <Link to="/admin/requests?new=1" className="font-semibold underline">Ask for access</Link> or ask your administrator to connect {name}.
              </p>
            )}
            <p className="text-[11.5px] text-subtle">Demo: no real {name} account is contacted.</p>
          </div>
        )}
        {phase === 'authorizing' && (
          <ol className="space-y-3 py-2" aria-live="polite">
            {steps.map((s, i) => (
              <li key={s} className="flex items-center gap-3 text-[13.5px]">
                {i < stepIdx ? <CheckCircle2 className="size-5 text-emerald-600" /> : i === stepIdx ? <Loader2 className="size-5 animate-spin text-primary" /> : <span className="size-5 rounded-full border-2 border-border" />}
                <span className={i > stepIdx ? 'text-subtle' : ''}>{s}</span>
              </li>
            ))}
          </ol>
        )}
        {phase === 'done' && (
          <div className="flex flex-col items-center py-3 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><ShieldCheck className="size-6" /></span>
            <p className="mt-3 text-[14px] font-medium">Connected with read-only access</p>
            <p className="mt-1 max-w-sm text-xs text-muted">{name} can now check {parts.length ? `${parts.length} ${parts.length === 1 ? 'part' : 'parts'}` : 'your parts'}. Scope: {integration.config?.scope ?? scopeText}. You can disconnect it anytime in Integrations.</p>
          </div>
        )}
        <DialogFooter>
          {phase === 'review' && (
            <>
              <Button variant="secondary" onClick={() => onOpenChange(false)}>Not now</Button>
              <Button disabled={!canConnect} onClick={authorize}><KeyRound /> Allow read-only access</Button>
            </>
          )}
          {phase === 'done' && <Button onClick={() => onOpenChange(false)}>Done</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AccessBlock({ icon, title, items, tone }: { icon: React.ReactNode; title: string; items: string[]; tone: 'sky' | 'emerald' | 'slate' }) {
  return (
    <div className="flex gap-3">
      <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4', tone === 'sky' ? 'bg-sky-50 text-sky-700' : tone === 'emerald' ? 'bg-emerald-50 text-emerald-700' : 'bg-surface-3 text-muted')}>{icon}</span>
      <div>
        <div className="text-xs font-semibold">{title}</div>
        <ul className="mt-1 space-y-0.5 text-[13px] text-muted">
          {items.map((x) => <li key={x}>• {x}</li>)}
        </ul>
      </div>
    </div>
  )
}
