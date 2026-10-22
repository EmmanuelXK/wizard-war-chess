import { createFileRoute } from "@tanstack/react-router"
import { lazy, Suspense, useEffect, useState } from "react"
import { Hud } from "@/game/Hud"

const BattleCanvas = lazy(() => import("@/game/BattleCanvas"))

export const Route = createFileRoute("/")({ component: Home })

function Home() {
  const [on, setOn] = useState(false)
  useEffect(() => {
    setOn(true)
  }, [])
  return (
    <main className="relative h-dvh overflow-hidden bg-bg font-sans text-fg">
      <div className="absolute inset-0 touch-none">
        {on ? (
          <Suspense fallback={null}>
            <BattleCanvas />
          </Suspense>
        ) : null}
      </div>
      <Hud />
    </main>
  )
}
