import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Database } from '@/types'
import { buildDatabase, buildEmptyDatabase, DB_VERSION } from '@/data/seed'

/**
 * The demo "backend": a single in-browser database persisted to localStorage.
 * Components never touch this store directly — they go through `services/api.ts`.
 */
interface DbState {
  db: Database
  setDb: (db: Database) => void
  /** Regenerates the current workspace (keeps the signed-in session). */
  reset: () => void
  /** Replaces the demo database with a workspace: the populated Northstar tenant or the empty Acme tenant. */
  loadWorkspace: (ws: Database['settings']['workspace']) => void
}

const STORAGE_KEY = 'do-safe-unified-demo-db'

const safeStorage = createJSONStorage<{ db: Database }>(() => ({
  getItem: (k) => {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  setItem: (k, v) => {
    try {
      localStorage.setItem(k, v)
    } catch (e) {
      console.warn('DO SAFE demo: unable to persist demo state', e)
    }
  },
  removeItem: (k) => {
    try {
      localStorage.removeItem(k)
    } catch {
      /* ignore */
    }
  },
}))

export const useDbStore = create<DbState>()(
  persist(
    (set) => ({
      db: buildDatabase(),
      setDb: (db) => set({ db }),
      reset: () =>
        set((st) => {
          const fresh = st.db.settings.workspace === 'acme' ? buildEmptyDatabase() : buildDatabase()
          const u = fresh.users.find((x) => x.id === st.db.settings.currentUserId)
          return { db: { ...fresh, settings: { ...fresh.settings, authenticated: st.db.settings.authenticated && !!u, currentUserId: u ? u.id : fresh.settings.currentUserId } } }
        }),
      loadWorkspace: (ws) => set({ db: ws === 'acme' ? buildEmptyDatabase() : buildDatabase() }),
    }),
    {
      name: STORAGE_KEY,
      storage: safeStorage,
      partialize: (s) => ({ db: s.db }),
      version: DB_VERSION,
      // A schema change invalidates stored demo data — regenerate rather than migrate.
      migrate: () => ({ db: buildDatabase() }),
    },
  ),
)

export const getDb = () => useDbStore.getState().db
export const setDb = (db: Database) => useDbStore.getState().setDb(db)

// Persist the freshly generated seed immediately so timestamps stay stable across reloads.
try {
  if (!localStorage.getItem(STORAGE_KEY)) useDbStore.getState().setDb(useDbStore.getState().db)
} catch {
  /* storage unavailable — demo still works in memory */
}
