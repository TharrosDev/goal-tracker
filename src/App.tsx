import { useEffect } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { useWorld } from '@/state/world'
import { AppShell } from '@/shell/AppShell'
import { WarTable } from '@/routes/WarTable'
import { StandardDetail } from '@/routes/StandardDetail'
import { Holding } from '@/routes/Holding'
import './design/index.css'

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <WarTable /> },
      { path: 'campaign', element: <Holding surface="campaign" /> },
      { path: 'dojo', element: <Holding surface="dojo" /> },
      { path: 'shrine', element: <Holding surface="shrine" /> },
      { path: 'chronicle', element: <Holding surface="chronicle" /> },
      { path: 'honours', element: <Holding surface="honours" /> },
      { path: 'survey', element: <Holding surface="survey" /> },
      { path: 'quartermaster', element: <Holding surface="quartermaster" /> },
      { path: 'plant', element: <Holding surface="standard" /> },
      { path: 'standard/:id', element: <StandardDetail /> },
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
