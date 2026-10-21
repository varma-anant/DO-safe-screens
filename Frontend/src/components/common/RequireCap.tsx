import { Link, Outlet } from 'react-router'
import { Lock } from 'lucide-react'
import { useCurrentUser } from '@/hooks/queries'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { can, explain, JOB_INFO, jobOf, ROLE_INFO, VIEW_CAPS, type Capability, type ViewCap } from '@/utils/permissions'
import { usePage } from '@/hooks/usePage'

/** Route guard: renders the child routes only if the signed-in person may see this area; otherwise explains why not. */
export function RequireCap({ cap, area }: { cap: Capability; area: string }) {
  const me = useCurrentUser()
  if (can(me, cap)) return <Outlet />
  const jobs = (VIEW_CAPS as string[]).includes(cap) ? Object.values(JOB_INFO).filter((j) => j.views.includes(cap as ViewCap)).map((j) => j.label) : []
  const reason = jobs.length ? `This area is for: ${jobs.join(', ')} (and administrators). Your job is ${JOB_INFO[jobOf(me)].label} — ask an administrator if you need it.` : explain(me, cap)
  return <Restricted area={area} reason={reason} />
}

export function Restricted({ area, reason }: { area: string; reason: string }) {
  const me = useCurrentUser()
  usePage(area, [{ label: area }])
  return (
    <Card className="mx-auto max-w-xl px-6 py-12 text-center" role="alert">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-surface-3 text-muted"><Lock className="size-5" /></span>
      <h1 className="mt-3 text-[18px] font-semibold">{area} isn’t part of your job</h1>
      <p className="mx-auto mt-1 max-w-md text-[13.5px] text-muted">{reason}</p>
      <p className="mt-3 text-[12.5px] text-muted">You’re signed in as {me?.name} · Job: {JOB_INFO[jobOf(me)].label} · Access: {me ? ROLE_INFO[me.orgRole].label : '—'}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Button asChild><Link to="/home">Go to my home</Link></Button>
        <Button asChild variant="secondary"><Link to="/requests?new=1">Ask for access</Link></Button>
      </div>
    </Card>
  )
}
