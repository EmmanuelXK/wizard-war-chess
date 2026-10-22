import { Compass, Crown, RotateCcw, Swords, Volume2, VolumeX } from "lucide-react"
import { useState } from "react"
import { useGame, type Side } from "./store"

const RANKS = ["Skirmish", "Battle", "Siege"] as const

export function Hud() {
  const phase = useGame((s) => s.phase)
  const caption = useGame((s) => s.caption)
  const chronicle = useGame((s) => s.chronicle)
  const result = useGame((s) => s.result)
  const check = useGame((s) => s.check)
  const muted = useGame((s) => s.muted)
  const difficulty = useGame((s) => s.difficulty)
  const player = useGame((s) => s.player)
  const mode = useGame((s) => s.mode)
  const turn = useGame((s) => s.turn)
  const start = useGame((s) => s.start)
  const undo = useGame((s) => s.undo)
  const toggleMute = useGame((s) => s.toggleMute)
  const resign = useGame((s) => s.resign)
  const resetView = useGame((s) => s.resetView)
  const promote = useGame((s) => s.promote)
  const [side, setSide] = useState<Side>("w")
  const [level, setLevel] = useState<0 | 1 | 2>(1)
  const [logOpen, setLogOpen] = useState(false)

  const thinking = phase === "think"
  const playing = phase === "play" || phase === "anim" || phase === "think" || phase === "promote" || phase === "over"

  return (
    <>
      <div className="pointer-events-none absolute inset-0 vignette" />
      <p className="sr-only" aria-live="polite">
        {caption}
        {result ? `. ${result}` : ""}
      </p>

      {playing && (
        <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-start justify-between gap-3 p-3 md:p-5">
          <div className="pointer-events-auto max-w-[16rem]">
            <p className="font-display text-lg leading-none text-fg md:text-2xl">Wizard War Chess</p>
            <p className="mt-1 text-sm text-muted">
              {mode === "hotseat"
                ? turn === "w"
                  ? "Pale host to move"
                  : "Dark host to move"
                : player === "w"
                  ? "You command the pale host"
                  : "You command the dark host"}
              {mode === "ai" ? ` · ${RANKS[difficulty]}` : ""}
            </p>
            <p className="mt-1 text-xs text-muted">Drag to orbit the field. Scroll or pinch to zoom.</p>
          </div>
          <div className="pointer-events-auto flex gap-2">
            <button type="button" className="icon-btn" onClick={resetView} aria-label="Reset the view">
              <Compass size={18} />
            </button>
            <button type="button" className="icon-btn" onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"}>
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <button type="button" className="icon-btn" onClick={undo} aria-label="Undo last blow">
              <RotateCcw size={18} />
            </button>
            <button type="button" className="icon-btn" onClick={resign} aria-label="Yield the field">
              <Swords size={18} />
            </button>
          </div>
        </header>
      )}

      {playing && check && phase !== "over" && (
        <p className="check-pulse pointer-events-none absolute left-1/2 top-20 z-10 -translate-x-1/2 font-display text-xl text-primary md:top-24">
          Check
        </p>
      )}

      {playing && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-3 px-3 pb-4 md:pb-6">
          <p className="caption max-w-3xl text-center font-display text-xl leading-tight text-fg md:text-3xl">
            {thinking ? "The stones consider the field" : caption}
          </p>
          <button type="button" className="pointer-events-auto ghost-btn md:hidden" onClick={() => setLogOpen((v) => !v)}>
            Chronicle
          </button>
        </div>
      )}

      {playing && (
        <aside
          className={`pointer-events-auto absolute z-10 max-h-[46%] w-[min(100%-1.5rem,18rem)] overflow-y-auto rounded-xl border border-border bg-surface/90 p-4 backdrop-blur-sm ${
            logOpen ? "bottom-24 left-3" : "bottom-24 left-3 hidden"
          } md:bottom-auto md:left-5 md:top-28 md:flex md:max-h-[58%] md:flex-col`}
        >
          <p className="font-display text-sm tracking-wide text-primary">Chronicle</p>
          <ol className="mt-3 flex flex-col gap-2 text-sm text-muted">
            {chronicle.length === 0 && <li>No blood on the stone yet.</li>}
            {chronicle.map((line, i) => (
              <li key={`${i}-${line}`} className="text-fg">
                {line}
              </li>
            ))}
          </ol>
        </aside>
      )}

      {phase === "menu" && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-bg/35 p-4">
          <div className="pointer-events-auto w-full max-w-md border border-border bg-surface px-6 py-7 shadow-lg">
            <p className="font-display text-xs tracking-widest text-primary">LIVING STONE</p>
            <h1 className="mt-2 font-display text-4xl leading-none text-fg">Wizard War Chess</h1>
            <p className="mt-3 text-base leading-relaxed text-muted">
              Standard chess. Each rank is its own stone fighter: they walk, and a capture is a killing blow. The loser
              shatters and stays on the field. Drag the board to walk around it.
            </p>
            <p className="mt-5 text-sm text-muted">Host</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" className={side === "w" ? "choice choice-on" : "choice"} onClick={() => setSide("w")}>
                Pale host
              </button>
              <button type="button" className={side === "b" ? "choice choice-on" : "choice"} onClick={() => setSide("b")}>
                Dark host
              </button>
            </div>
            <p className="mt-4 text-sm text-muted">Opposition</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {RANKS.map((name, i) => (
                <button
                  key={name}
                  type="button"
                  className={level === i ? "choice choice-on" : "choice"}
                  onClick={() => setLevel(i as 0 | 1 | 2)}
                >
                  {name}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="mt-6 flex min-h-11 w-full items-center justify-center gap-2 bg-primary px-4 py-3 font-display text-lg text-ink"
              onClick={() => start({ player: side, difficulty: level, mode: "ai" })}
            >
              <Crown size={18} />
              Take the field
            </button>
            <button
              type="button"
              className="mt-2 min-h-11 w-full text-sm text-muted"
              onClick={() => start({ player: "w", difficulty: level, mode: "hotseat" })}
            >
              Two commanders, one board
            </button>
          </div>
        </div>
      )}

      {phase === "promote" && (
        <div className="absolute inset-0 z-30 flex items-end justify-center bg-bg/40 p-4 pb-28 md:items-center md:pb-4">
          <div className="w-full max-w-md border border-border bg-surface p-5">
            <p className="font-display text-2xl text-fg">The pawn reaches the last rank</p>
            <p className="mt-1 text-sm text-muted">Choose what it becomes. It keeps the square it took.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {(
                [
                  ["q", "Queen"],
                  ["r", "Rook"],
                  ["b", "Bishop"],
                  ["n", "Knight"],
                ] as const
              ).map(([id, label]) => (
                <button key={id} type="button" className="choice choice-on min-h-11" onClick={() => promote(id)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {phase === "over" && result && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center p-4">
          <div className="pointer-events-auto w-full max-w-md border border-border bg-surface px-6 py-7 text-center">
            <p className="font-display text-3xl text-fg">{result}</p>
            <p className="mt-2 text-sm text-muted">The rubble stays where it fell.</p>
            <button
              type="button"
              className="mt-6 min-h-11 w-full bg-primary px-4 py-3 font-display text-lg text-ink"
              onClick={() => start({ player, difficulty, mode })}
            >
              Fight again
            </button>
          </div>
        </div>
      )}
    </>
  )
}
