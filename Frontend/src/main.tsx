import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/misc'
import { useDbStore } from '@/stores/db'
import { router } from '@/app/router'
import '@/styles/index.css'

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false, refetchOnWindowFocus: false } } })

// Every change to the demo database (API mutations, simulated agent runs) refreshes dependent views.
let prev = useDbStore.getState().db
useDbStore.subscribe((s) => {
  if (s.db === prev) return
  const changed = (Object.keys(s.db) as (keyof typeof s.db)[]).filter((k) => s.db[k] !== prev[k])
  prev = s.db
  // A change to people (e.g. someone's job) can change what every collection shows them.
  if (changed.includes('users')) queryClient.invalidateQueries()
  else changed.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }))
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RouterProvider router={router} />
        {/* Top-right, below the header: never covers page titles or the primary action in sticky step footers. */}
        <Toaster theme="light" position="top-right" offset={72} richColors closeButton />
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>,
)
