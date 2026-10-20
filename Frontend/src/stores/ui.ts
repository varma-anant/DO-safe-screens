import { create } from 'zustand'

export interface Crumb {
  label: string
  to?: string
}

interface UiState {
  title: string
  crumbs: Crumb[]
  sidebarCollapsed: boolean
  mobileNavOpen: boolean
  searchOpen: boolean
  setPage: (title: string, crumbs: Crumb[]) => void
  toggleSidebar: () => void
  setMobileNav: (v: boolean) => void
  setSearchOpen: (v: boolean) => void
}

export const useUiStore = create<UiState>()((set) => ({
  title: 'DO SAFE',
  crumbs: [],
  sidebarCollapsed: false,
  mobileNavOpen: false,
  searchOpen: false,
  setPage: (title, crumbs) => set({ title, crumbs }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setMobileNav: (v) => set({ mobileNavOpen: v }),
  setSearchOpen: (v) => set({ searchOpen: v }),
}))
