import * as React from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { KeyRound, Loader2 } from 'lucide-react'
import { useDbStore } from '@/stores/db'
import { ACME_USERS } from '@/data/seed'
import { USERS } from '@/data/seed/reference'
import * as api from '@/services/api'
import { JOB_INFO } from '@/utils/permissions'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { NativeSelect } from '@/components/ui/input'
import type { Database } from '@/types'

export function LoginPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const session = useDbStore((s) => s.db.settings)
  const [ws, setWs] = React.useState<Database['settings']['workspace']>(session.workspace)
  const [open, setOpen] = React.useState(false)
  const [error, setError] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  React.useEffect(() => { document.title = 'Sign in · DO SAFE' }, [])
  if (session.authenticated) return <Navigate to={params.get('next') || '/home'} replace />
  async function signIn(email: string) {
    setBusy(true); setError('')
    try {
      await api.login(email, 'demo-sso', ws)
      navigate(ws === session.workspace ? params.get('next') || '/home' : '/home', { replace: true })
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to sign in. Select your account to retry.') }
    finally { setBusy(false) }
  }
  return <div className="flex min-h-full items-center justify-center bg-bg px-5 py-12">
    <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-10 shadow-sm">
      <div className="mb-10 flex items-center justify-center gap-3"><span className="flex size-11 items-center justify-center rounded-xl bg-[#1b1b25] text-sm font-bold text-white">DO</span><h1 className="text-xl font-semibold">DO SAFE</h1></div>
      <Button size="lg" className="w-full" onClick={() => setOpen(true)}><KeyRound /> Sign in with SSO</Button>
    </div>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent title="Select your organization account" description="Simulated identity provider for this prototype.">
      <label className="mb-4 block text-sm">Organization<NativeSelect className="mt-2" value={ws} onChange={e => { setWs(e.target.value as typeof ws); setError('') }}><option value="northstar">Northstar Financial</option><option value="acme">Acme Corporation</option></NativeSelect></label>
      <div className="space-y-2">{(ws === 'northstar' ? USERS : ACME_USERS).filter(u => u.demoLogin).map(u => <button key={u.id} disabled={busy} onClick={() => signIn(u.email)} className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left hover:bg-surface-2 disabled:opacity-50"><span className="flex size-9 items-center justify-center rounded-full bg-primary-soft text-xs text-primary">{u.initials}</span><span className="min-w-0"><span className="block text-sm font-medium">{u.name}</span><span className="block text-xs text-muted">{JOB_INFO[u.job].label}</span></span></button>)}</div>
      {busy && <p role="status" className="mt-4 flex items-center gap-2 text-sm"><Loader2 className="size-4 animate-spin" /> Signing in…</p>}
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    </DialogContent></Dialog>
  </div>
}
