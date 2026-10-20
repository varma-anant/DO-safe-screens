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
  changed.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }))
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RouterProvider router={router} />
        <Toaster theme="dark" position="bottom-right" richColors closeButton toastOptions={{ style: { background: '#171c2b', border: '1px solid #2f3850' } }} />
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>,
)
