import { FolderKanban, AppWindow, Boxes, Waypoints, Plug, Play, ShieldCheck } from 'lucide-react'
import type { BusinessService } from '@/types'
import type { GlossaryKey } from '@/utils/plain'

/** The one definition of the onboarding journey — used by Home, the wizard and the Knowledge base. */
export const JOURNEY: { key: string; label: string; help: string; term?: GlossaryKey; minutes: number; icon: React.ReactNode }[] = [
  { key: 'project', label: 'Pick a project', help: 'A folder to keep it organized', term: 'project', minutes: 1, icon: <FolderKanban /> },
  { key: 'application', label: 'Describe your app', help: 'What it is and how important it is', term: 'application', minutes: 1, icon: <AppWindow /> },
  { key: 'assets', label: 'List its parts', help: 'Website, database, code… we suggest them', term: 'asset', minutes: 2, icon: <Boxes /> },
  { key: 'map', label: 'Connect the parts', help: 'How the parts talk to each other', term: 'map', minutes: 1, icon: <Waypoints /> },
  { key: 'connect', label: 'Connect your tools', help: 'Give read-only access to your security tools', term: 'source', minutes: 3, icon: <Plug /> },
  { key: 'test', label: 'Test run', help: 'A safe check that everything is reachable', term: 'test', minutes: 1, icon: <Play /> },
  { key: 'full', label: 'Turn on protection', help: 'The full run, then daily checks', term: 'full', minutes: 1, icon: <ShieldCheck /> },
]

export function stepFromStatus(app?: BusinessService) {
  if (!app) return 0
  return { draft: 2, assets_declared: 3, mapped: 4, connected: 5, test_failed: 5, test_passed: 6, active: 6, paused: 6 }[app.status]
}
