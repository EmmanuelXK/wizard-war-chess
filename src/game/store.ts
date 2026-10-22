import { Chess, type Move, type Square } from "chess.js"
import { create } from "zustand"
import { sfx, setMuted, unlockAudio } from "./audio"
import type { PieceSnap } from "./actors"
import { battle, mateYield, piecesNow, planMove, resetActors, restorePieces, startPlayback } from "./director"

export type Phase = "menu" | "play" | "anim" | "think" | "promote" | "over"
export type Mode = "ai" | "hotseat"
export type Side = "w" | "b"

type Legal = { to: string; capture: boolean }

type Snap = { fen: string; pieces: PieceSnap[]; chronicle: string[] }

type State = {
  phase: Phase
  mode: Mode
  player: Side
  difficulty: 0 | 1 | 2
  fen: string
  turn: Side
  check: boolean
  selected: string | null
  legal: Legal[]
  lastFrom: string | null
  lastTo: string | null
  caption: string
  chronicle: string[]
  result: string | null
  pending: { from: string; to: string } | null
  muted: boolean
  epoch: number
  battleId: number
  viewNonce: number
  start: (opts: { player: Side; difficulty: 0 | 1 | 2; mode: Mode }) => void
  pick: (square: string) => void
  promote: (piece: "q" | "r" | "b" | "n") => void
  undo: () => void
  toggleMute: () => void
  resign: () => void
  resetView: () => void
}

const NAMES: Record<string, string> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
}

let chess = new Chess()
let stack: Snap[] = []
let job = 0
let worker: Worker | null = null

function host(color: Side) {
  return color === "w" ? "Pale" : "Dark"
}

function sq(square: string): Square {
  return square as Square
}

function describe(move: Move) {
  const who = `${host(move.color)} ${NAMES[move.piece]}`
  if (move.flags.includes("k")) return `${host(move.color)} king castles kingside`
  if (move.flags.includes("q")) return `${host(move.color)} king castles queenside`
  let line = move.captured
    ? `${who} destroys the ${NAMES[move.captured]}`
    : `${who} to ${move.to}`
  if (move.promotion) line += ` and rises as a ${NAMES[move.promotion]}`
  if (chess.isCheckmate()) return `${line}. The king is finished`
  if (chess.inCheck()) return `${line}. Check`
  return line
}

function resultText(player: Side, mode: Mode) {
  if (chess.isCheckmate()) {
    const loser = chess.turn()
    if (mode === "hotseat") return loser === "w" ? "The pale king yields" : "The dark king yields"
    return loser === player ? "Your king is broken" : "The enemy king yields"
  }
  if (chess.isStalemate()) return "Stalemate. The field falls still"
  if (chess.isInsufficientMaterial()) return "Not enough stone left to finish it"
  if (chess.isThreefoldRepetition()) return "The same ground, three times. Drawn"
  if (chess.isDrawByFiftyMoves()) return "Fifty quiet moves. Drawn"
  return "Drawn. Neither host can finish it"
}

function syncSelection(square: string | null) {
  if (!square) {
    battle.selectedId = null
    return
  }
  const actor = battle.actors.find((a) => a.square === square && !a.dying)
  battle.selectedId = actor?.id ?? null
}

function ensureWorker() {
  if (typeof window === "undefined") return null
  if (!worker) {
    worker = new Worker(new URL("./ai.worker.ts", import.meta.url), { type: "module" })
  }
  return worker
}

function pushSnap(chronicle: string[]) {
  stack.push({ fen: chess.fen(), pieces: piecesNow(), chronicle: chronicle.slice() })
  if (stack.length > 80) stack.shift()
}

export const useGame = create<State>((set, get) => ({
  phase: "menu",
  mode: "ai",
  player: "w",
  difficulty: 1,
  fen: chess.fen(),
  turn: "w",
  check: false,
  selected: null,
  legal: [],
  lastFrom: null,
  lastTo: null,
  caption: "The stones are waiting",
  chronicle: [],
  result: null,
  pending: null,
  muted: false,
  epoch: 0,
  battleId: 1,
  viewNonce: 0,

  start: ({ player, difficulty, mode }) => {
    unlockAudio()
    job++
    chess = new Chess()
    stack = []
    resetActors()
    syncSelection(null)
    const opening = player === "b" && mode === "ai"
    set({
      phase: opening ? "think" : "play",
      mode,
      player,
      difficulty,
      fen: chess.fen(),
      turn: "w",
      check: false,
      selected: null,
      legal: [],
      lastFrom: null,
      lastTo: null,
      caption: opening ? "The pale host takes the first step" : "Command a piece",
      chronicle: [],
      result: null,
      pending: null,
      battleId: get().battleId + 1,
      epoch: get().epoch + 1,
      viewNonce: get().viewNonce + 1,
    })
    if (opening) requestAi()
  },

  pick: (square) => {
    const state = get()
    if (state.phase !== "play") return
    if (!/^[a-h][1-8]$/.test(square)) return
    unlockAudio()
    const mine = state.mode === "hotseat" ? chess.turn() : state.player
    if (chess.turn() !== mine) return

    if (state.selected) {
      const options = chess.moves({ square: sq(state.selected), verbose: true }).filter((m) => m.to === square)
      if (options.length) {
        if (options.some((m) => m.promotion)) {
          set({ phase: "promote", pending: { from: state.selected, to: square } })
          return
        }
        commit(options[0])
        return
      }
    }

    const piece = chess.get(sq(square))
    if (piece && piece.color === mine) {
      const legal = chess
        .moves({ square: sq(square), verbose: true })
        .filter((m, i, all) => all.findIndex((o) => o.to === m.to) === i)
        .map((m) => ({ to: m.to, capture: Boolean(m.captured) }))
      syncSelection(square)
      set({ selected: square, legal, caption: legal.length ? "Choose a square" : "That piece has nowhere to go" })
      return
    }
    syncSelection(null)
    set({ selected: null, legal: [] })
  },

  promote: (piece) => {
    const state = get()
    if (state.phase !== "promote" || !state.pending) return
    const options = chess
      .moves({ square: sq(state.pending.from), verbose: true })
      .filter((m) => m.to === state.pending!.to && m.promotion === piece)
    if (!options[0]) return
    commit(options[0])
  },

  undo: () => {
    const state = get()
    if (state.phase !== "play" && state.phase !== "over") return
    const steps = state.mode === "ai" ? 2 : 1
    if (stack.length < steps) return
    let snap: Snap | undefined
    for (let i = 0; i < steps; i++) snap = stack.pop()
    if (!snap) return
    job++
    chess.load(snap.fen)
    restorePieces(snap.pieces)
    syncSelection(null)
    set({
      phase: "play",
      fen: chess.fen(),
      turn: chess.turn() as Side,
      check: chess.inCheck(),
      selected: null,
      legal: [],
      lastFrom: null,
      lastTo: null,
      caption: "The blow is taken back",
      chronicle: snap.chronicle,
      result: null,
      pending: null,
      epoch: state.epoch + 1,
    })
  },

  toggleMute: () => {
    const next = !get().muted
    setMuted(next)
    set({ muted: next })
  },

  resign: () => {
    const state = get()
    if (state.phase === "menu" || state.phase === "over") return
    job++
    battle.token++
    battle.play = null
    const loser = state.mode === "hotseat" ? chess.turn() : state.player
    set({
      phase: "over",
      result: loser === "w" ? "The pale king yields the field" : "The dark king yields the field",
      selected: null,
      legal: [],
      pending: null,
    })
  },

  resetView: () => set((s) => ({ viewNonce: s.viewNonce + 1 })),
}))

battle.onPromote = () => {
  useGame.setState((s) => ({ epoch: s.epoch + 1 }))
}

function commit(choice: Move) {
  const state = useGame.getState()
  pushSnap(state.chronicle)
  const played = chess.move(choice.san)
  if (!played) return
  const steps = planMove(played)
  if (chess.isCheckmate()) {
    const yieldStep = mateYield(chess.turn())
    if (yieldStep) steps.push(yieldStep)
  }
  const caption = describe(played)
  if (chess.inCheck()) sfx.bell()
  syncSelection(null)
  useGame.setState({
    phase: "anim",
    fen: chess.fen(),
    turn: chess.turn() as Side,
    check: chess.inCheck(),
    selected: null,
    legal: [],
    pending: null,
    lastFrom: played.from,
    lastTo: played.to,
    caption,
    chronicle: [...state.chronicle, caption],
  })
  startPlayback(steps, () => {
    const now = useGame.getState()
    if (chess.isGameOver()) {
      useGame.setState({
        phase: "over",
        result: resultText(now.player, now.mode),
        check: chess.inCheck(),
        fen: chess.fen(),
      })
      return
    }
    const playerTurn = now.mode === "hotseat" || chess.turn() === now.player
    useGame.setState({
      phase: playerTurn ? "play" : "think",
      check: chess.inCheck(),
      fen: chess.fen(),
      turn: chess.turn() as Side,
      caption: playerTurn ? "Your command" : "The stones consider the field",
    })
    if (!playerTurn) requestAi()
  })
}

function applyAi(from: string, to: string, promotion?: string) {
  if (useGame.getState().phase !== "think") return
  const options = chess.moves({ verbose: true }).filter((m) => m.from === from && m.to === to && m.promotion === promotion)
  const choice = options[0] ?? chess.moves({ verbose: true }).find((m) => m.from === from && m.to === to)
  if (!choice) {
    const any = chess.moves({ verbose: true })[0]
    if (any) commit(any)
    return
  }
  commit(choice)
}

function requestAi() {
  const state = useGame.getState()
  const id = ++job
  const depth = state.difficulty === 0 ? 2 : state.difficulty === 1 ? 3 : 4
  const ms = state.difficulty === 0 ? 360 : state.difficulty === 1 ? 700 : 1100
  const spice = state.difficulty === 0
  const fen = chess.fen()
  const bot = ensureWorker()
  if (!bot) {
    const moves = chess.moves({ verbose: true })
    const pick = moves[Math.floor(Math.random() * moves.length)]
    if (pick) applyAi(pick.from, pick.to, pick.promotion)
    return
  }
  bot.onmessage = (event: MessageEvent<{ id: number; from: string; to: string; promotion?: string }>) => {
    if (event.data.id !== id || job !== id) return
    applyAi(event.data.from, event.data.to, event.data.promotion)
  }
  bot.onerror = () => {
    if (job !== id) return
    const moves = chess.moves({ verbose: true })
    const caps = moves.filter((m) => m.captured)
    const pool = caps.length ? caps : moves
    const pick = pool[Math.floor(Math.random() * pool.length)]
    if (pick) applyAi(pick.from, pick.to, pick.promotion)
  }
  bot.postMessage({ id, fen, depth, ms, spice })
}
