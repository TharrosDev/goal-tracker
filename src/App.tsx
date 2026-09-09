import { useEffect } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { useWorld } from '@/state/world'
import { AppShell } from '@/shell/AppShell'
import { WarTable } from '@/routes/WarTable'
import './design/index.css'

/**
 * THE SURFACES.
 *
 * Only the war table is in the entry chunk. It is the index route and the first
 * thing anybody sees, so a lazy boundary there would buy a few kilobytes at the
 * cost of a blank frame on every cold start — which is the one place in this
 * product where a blank frame is unaffordable.
 *
 * Everything else arrives when it is asked for. Each of these is a surface
 * somebody navigates to deliberately, over a local network of exactly zero
 * hops, and the chunk is already in the offline cache by the second visit.
 *
 * `lazy` takes a module and reads `Component` off it, so each of these names
 * its own export rather than the file having to have a default. That keeps the
 * routes greppable: the component is still `export function Chronicle`.
 */
const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <WarTable /> },
      {
        path: 'campaign',
        lazy: async () => ({ Component: (await import('@/routes/Campaign')).Campaign }),
      },
      { path: 'dojo', lazy: async () => ({ Component: (await import('@/routes/Dojo')).Dojo }) },
      {
        path: 'shrine',
        lazy: async () => ({ Component: (await import('@/routes/Shrine')).Shrine }),
      },
      {
        path: 'chronicle',
        lazy: async () => ({ Component: (await import('@/routes/Chronicle')).Chronicle }),
      },
      {
        path: 'honours',
        lazy: async () => ({ Component: (await import('@/routes/Honours')).Honours }),
      },
      {
        path: 'survey',
        lazy: async () => ({ Component: (await import('@/routes/Survey')).Survey }),
      },
      {
        path: 'quartermaster',
        lazy: async () => ({
          Component: (await import('@/routes/Quartermaster')).Quartermaster,
        }),
      },
      { path: 'plant', lazy: async () => ({ Component: (await import('@/routes/Plant')).Plant }) },
      {
        path: 'standard/:id',
        lazy: async () => ({
          Component: (await import('@/routes/StandardDetail')).StandardDetail,
        }),
      },
    ],
  },
])

export function App() {
  const boot = useWorld((s) => s.boot)
  const ready = useWorld((s) => s.ready)
  const error = useWorld((s) => s.error)

  useEffect(() => {
    void boot()
  }, [boot])

  if (error)
    return (
      <main className="boot-error">
        <p className="label">THE CAMP DID NOT OPEN</p>
        <p className="lede">{error}</p>
        <p className="lede">Your data is still on this device. Nothing has been written or lost.</p>
      </main>
    )

  // Held rather than spinner-ed: the database opens in single-digit
  // milliseconds, so anything shown here would be a flash, not information.
  if (!ready) return <div aria-busy="true" />

  return <RouterProvider router={router} />
}
