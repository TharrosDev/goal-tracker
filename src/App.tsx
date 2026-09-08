import { useEffect } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { useWorld } from '@/state/world'
import { AppShell } from '@/shell/AppShell'
import { WarTable } from '@/routes/WarTable'
import { StandardDetail } from '@/routes/StandardDetail'
import { Plant } from '@/routes/Plant'
import { Campaign } from '@/routes/Campaign'
import { Chronicle } from '@/routes/Chronicle'
import { Shrine } from '@/routes/Shrine'
import { Honours } from '@/routes/Honours'
import { Dojo } from '@/routes/Dojo'
import { Survey } from '@/routes/Survey'
import { Quartermaster } from '@/routes/Quartermaster'
import './design/index.css'

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <WarTable /> },
      { path: 'campaign', element: <Campaign /> },
      { path: 'dojo', element: <Dojo /> },
      { path: 'shrine', element: <Shrine /> },
      { path: 'chronicle', element: <Chronicle /> },
      { path: 'honours', element: <Honours /> },
      { path: 'survey', element: <Survey /> },
      { path: 'quartermaster', element: <Quartermaster /> },
      { path: 'plant', element: <Plant /> },
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
