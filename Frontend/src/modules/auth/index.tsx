import * as React from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { Building2, KeyRound, Loader2, ShieldCheck, Sparkles } from 'lucide-react'
import { useDbStore } from '@/stores/db'
import { ACME_USERS } from '@/data/seed'
import { USERS } from '@/data/seed/reference'
import * as api from '@/services/api'
import { ROLE_INFO } from '@/utils/permissions'
import { cn } from '@/utils/format'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'
import type { Database, User } from '@/types'

type Ws = Database['settings']['workspace']

// Demo account lists per workspace (read from the seed so they always match the data).
const DEMO: Record<Ws, User[]> = {
  northstar: USERS.filter((u) => u.demoLogin),
  acme: ACME_USERS.filter((u) => u.demoLogin),
}

export function LoginPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const session = useDbStore((s) => s.db.settings)
  const [ws, setWs] = React.useState<Ws>(session.workspace)
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  React.useEffect(() => {
    document.title = 'Sign in · DO SAFE'
  }, [])
  if (session.authenticated) return <Navigate to={params.get('next') || '/home'} replace />

  const submit = async (e?: React.FormEvent, overrideEmail?: string) => {
    e?.preventDefault()
    const em = overrideEmail ?? email
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return setError('Enter a valid work email address.')
    if (!overrideEmail && password.length < 4) return setError('Enter your password (any 4+ characters in this demo).')
    setBusy(true)
    setError(null)
    try {
      await api.login(em, overrideEmail ? 'demo-sso' : password, ws)
      navigate(params.get('next') && ws === session.workspace ? params.get('next')! : '/home', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full bg-bg">
      <div className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-[#16161d] p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-white text-[13px] font-bold text-[#16161d]">DO</div>
          <div>
            <div className="text-lg font-semibold leading-tight">DO SAFE</div>
            <div className="text-xs text-white/60">Autonomous cyber risk management</div>
          </div>
        </div>
        <div className="max-w-md">
          <h1 className="text-[34px] font-semibold leading-tight tracking-tight" style={{ textWrap: 'balance' }}>Know what you're protecting. Fix what matters first.</h1>
          <ul className="mt-8 space-y-4 text-[14px] text-white/80">
            <li className="flex gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#a594ff]" /> Map your applications and assets, test the connection, then run continuous assessments.</li>
            <li className="flex gap-3"><Sparkles className="mt-0.5 size-5 shrink-0 text-[#a594ff]" /> Every finding explained: source, evidence, CVE/CWE/ATT&CK mapping, root cause and fix.</li>
            <li className="flex gap-3"><KeyRound className="mt-0.5 size-5 shrink-0 text-[#a594ff]" /> Role-based access, approval gates and a complete audit trail for enterprise teams.</li>
          </ul>
        </div>
        <p className="text-xs text-white/40">Interactive prototype · all organizations, people and data are simulated.</p>
        <div className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-[#6b47f5]/25 blur-3xl" />
      </div>
      <div className="flex flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-[420px]">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-[#16161d] text-[12px] font-bold text-white">DO</div>
              <span className="text-lg font-semibold">DO SAFE</span>
            </div>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">Sign in to your workspace</h2>
          <p className="mt-1 text-sm text-muted">Use your work account. Access depends on your role and project membership.</p>

          <div className="mt-6">
            <div className="mb-1.5 text-xs font-medium text-muted">Workspace</div>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Workspace">
              {([
                ['northstar', 'Northstar Financial', 'Established · 8 applications'],
                ['acme', 'Acme Corporation', 'New customer · nothing set up'],
              ] as const).map(([id, name, sub]) => (
                <button key={id} type="button" role="radio" aria-checked={ws === id} onClick={() => { setWs(id); setEmail(''); setError(null) }} className={cn('rounded-xl border bg-surface p-3 text-left transition-colors cursor-pointer', ws === id ? 'border-primary ring-2 ring-primary/15' : 'border-border hover:border-border-strong')}>
                  <Building2 className={cn('size-4', ws === id ? 'text-primary' : 'text-subtle')} />
                  <div className="mt-1.5 text-[13px] font-medium">{name}</div>
                  <div className="text-[11.5px] text-subtle">{sub}</div>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
            <Field label="Work email">
              <Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={DEMO[ws][0]?.email} />
            </Field>
            <Field label="Password">
              <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </Field>
            {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">{error}</p>}
            <Button type="submit" className="w-full" size="lg" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />} Sign in
            </Button>
            <Button type="button" variant="secondary" className="w-full" size="lg" disabled={busy || !email} onClick={() => submit(undefined, email)}>
              Continue with SSO
            </Button>
            <p className="text-center text-[11.5px] text-subtle">SSO is simulated. Any password of 4+ characters works in this demo.</p>
          </form>

          <div className="mt-7">
            <div className="mb-2 text-xs font-medium text-muted">Demo accounts — click to sign in</div>
            <div className="space-y-1.5">
              {DEMO[ws].map((u) => (
                <button key={u.id} type="button" disabled={busy} onClick={() => { setEmail(u.email); submit(undefined, u.email) }} className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2 text-left hover:border-primary/40 enabled:cursor-pointer">
                  <span className="flex size-8 items-center justify-center rounded-full bg-[#4b3fa8] text-[11px] font-semibold text-white">{u.initials}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium">{u.name}</span>
                    <span className="block truncate text-[11.5px] text-subtle">{u.email}</span>
                  </span>
                  <span className="rounded-md bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary">{ROLE_INFO[u.orgRole].label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
