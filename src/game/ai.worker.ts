import { Chess, type Move } from "chess.js"

type Req = { id: number; fen: string; depth: number; ms: number; spice: boolean }
type Res = { id: number; from: string; to: string; promotion?: string }

const VAL: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 }

const TABLES: Record<string, number[]> = {
  p: [
    0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10,
    25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10,
    10, 5, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  n: [
    -50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 5, 5, 0, -20, -40, -30, 5, 10, 15, 15, 10, 5,
    -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 10, 15, 15, 10, 0, -30,
    -40, -20, 0, 0, 0, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50,
  ],
  b: [
    -20, -10, -10, -10, -10, -10, -10, -20, -10, 5, 0, 0, 0, 0, 5, -10, -10, 10, 10, 10, 10, 10, 10, -10,
    -10, 0, 10, 10, 10, 10, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 0, 0,
    0, 0, 0, 0, -10, -20, -10, -10, -10, -10, -10, -10, -20,
  ],
  r: [
    0, 0, 0, 5, 5, 0, 0, 0, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 5, 10, 10, 10, 10, 10, 10, 5, 0, 0, 0, 0, 0, 0,
    0, 0,
  ],
  q: [
    -20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0,
    5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0,
    0, -10, -20, -10, -10, -5, -5, -10, -10, -20,
  ],
  k: [
    -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50,
    -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20,
    -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20,
  ],
}

let deadline = 0
let aborted = false
let nodes = 0

function pst(type: string, color: "w" | "b", file: number, rankFromWhite: number) {
  const table = TABLES[type]
  if (!table) return 0
  const idx = color === "w" ? rankFromWhite * 8 + file : (7 - rankFromWhite) * 8 + file
  return table[idx] ?? 0
}

function evaluate(game: Chess) {
  const board = game.board()
  let score = 0
  for (let row = 0; row < 8; row++) {
    for (let file = 0; file < 8; file++) {
      const piece = board[row][file]
      if (!piece) continue
      const rankFromWhite = 7 - row
      const sign = piece.color === "w" ? 1 : -1
      score += sign * ((VAL[piece.type] ?? 0) + pst(piece.type, piece.color, file, rankFromWhite))
    }
  }
  return game.turn() === "w" ? score : -score
}

function order(moves: Move[]) {
  return moves
    .map((m) => {
      let s = 0
      if (m.captured) s += 10 * (VAL[m.captured] ?? 0) - (VAL[m.piece] ?? 0)
      if (m.promotion) s += 800
      return { m, s }
    })
    .sort((a, b) => b.s - a.s)
    .map((x) => x.m)
}

function negamax(game: Chess, depth: number, alpha: number, beta: number, ply: number): number {
  nodes++
  if ((nodes & 127) === 0 && performance.now() > deadline) {
    aborted = true
    return 0
  }
  if (game.isCheckmate()) return -100000 + ply
  if (game.isDraw()) return 0
  if (depth === 0) return quiesce(game, alpha, beta, 2, ply)

  const moves = order(game.moves({ verbose: true }))
  let best = -Infinity
  for (const m of moves) {
    game.move(m)
    const score = -negamax(game, depth - 1, -beta, -alpha, ply + 1)
    game.undo()
    if (aborted) return best === -Infinity ? 0 : best
    if (score > best) best = score
    if (score > alpha) alpha = score
    if (alpha >= beta) break
  }
  return best
}

function quiesce(game: Chess, alpha: number, beta: number, q: number, ply: number): number {
  nodes++
  const stand = evaluate(game)
  if (stand >= beta) return beta
  if (stand > alpha) alpha = stand
  if (q === 0) return stand
  const moves = order(game.moves({ verbose: true }).filter((m) => m.captured))
  for (const m of moves) {
    if (performance.now() > deadline) {
      aborted = true
      return stand
    }
    game.move(m)
    const score = -quiesce(game, -beta, -alpha, q - 1, ply + 1)
    game.undo()
    if (score >= beta) return beta
    if (score > alpha) alpha = score
  }
  return alpha
}

function choose(req: Req): Res {
  const game = new Chess(req.fen)
  const moves = game.moves({ verbose: true })
  if (!moves.length) return { id: req.id, from: "a1", to: "a1" }
  if (req.spice && Math.random() < 0.42) {
    const caps = moves.filter((m) => m.captured)
    const pool = caps.length && Math.random() < 0.55 ? caps : moves
    const pick = pool[Math.floor(Math.random() * pool.length)]
    return { id: req.id, from: pick.from, to: pick.to, promotion: pick.promotion }
  }
  deadline = performance.now() + req.ms
  let best = moves[0]
  const maxDepth = req.depth
  for (let d = 1; d <= maxDepth; d++) {
    aborted = false
    nodes = 0
    let alpha = -Infinity
    let local = best
    const ordered = order(moves)
    const idx = ordered.findIndex((m) => m.from === best.from && m.to === best.to && m.promotion === best.promotion)
    if (idx > 0) {
      const [fav] = ordered.splice(idx, 1)
      ordered.unshift(fav)
    }
    for (const m of ordered) {
      if (d > 1 && performance.now() > deadline) {
        aborted = true
        break
      }
      game.move(m)
      const score = d === 1 ? -evaluate(game) : -negamax(game, d - 1, -Infinity, -alpha, 1)
      game.undo()
      if (aborted) break
      if (score > alpha) {
        alpha = score
        local = m
      }
    }
    if (!aborted) best = local
    else break
  }
  return { id: req.id, from: best.from, to: best.to, promotion: best.promotion }
}

self.onmessage = (event: MessageEvent<Req>) => {
  const result = choose(event.data)
  self.postMessage(result)
}
