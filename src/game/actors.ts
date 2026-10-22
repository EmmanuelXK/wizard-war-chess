import type { Color, PieceSymbol } from "chess.js"

export const STEP = 1.16
export const FLOOR = 0.23

export type Shard = {
  on: boolean
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  rx: number
  ry: number
  rz: number
  vrx: number
  vry: number
  s: number
}

export type Pose = {
  bob: number
  lean: number
  lunge: number
  legL: number
  legR: number
  armL: number
  armR: number
  twist: number
  strike: number
  wind: number
  dead: number
  yield: number
  legFL: number
  legFR: number
  legBL: number
  legBR: number
  neck: number
}

export type Actor = {
  id: string
  type: PieceSymbol
  color: Color
  square: string
  dying: boolean
  gone: boolean
  yielded: boolean
  seed: number
  cycle: number
  yaw: number
  pos: { x: number; y: number; z: number }
  pose: Pose
  flash: number
  shards: Shard[]
  shardLive: boolean
}

export function emptyPose(): Pose {
  return {
    bob: 0,
    lean: 0,
    lunge: 0,
    legL: 0,
    legR: 0,
    armL: 0,
    armR: 0,
    twist: 0,
    strike: 0,
    wind: 0,
    dead: 0,
    yield: 0,
    legFL: 0,
    legFR: 0,
    legBL: 0,
    legBR: 0,
    neck: 0,
  }
}

export function homeYaw(color: Color) {
  return color === "w" ? Math.PI : 0
}

export function squareToVec(square: string): [number, number, number] {
  const file = square.charCodeAt(0) - 97
  const rank = Number(square[1]) - 1
  return [(file - 3.5) * STEP, 0, (3.5 - rank) * STEP]
}

function hash(id: string) {
  let h = 0
  for (const c of id) h = (h * 33 + c.charCodeAt(0)) >>> 0
  return (h % 1000) / 1000
}

function makeShards(): Shard[] {
  return Array.from({ length: 10 }, () => ({
    on: false,
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    rx: 0,
    ry: 0,
    rz: 0,
    vrx: 0,
    vry: 0,
    s: 0.1,
  }))
}

export function makeActor(id: string, type: PieceSymbol, color: Color, square: string): Actor {
  const pos = squareToVec(square)
  return {
    id,
    type,
    color,
    square,
    dying: false,
    gone: false,
    yielded: false,
    seed: hash(id) * Math.PI * 2,
    cycle: 0,
    yaw: homeYaw(color),
    pos: { x: pos[0], y: 0, z: pos[2] },
    pose: emptyPose(),
    flash: 0,
    shards: makeShards(),
    shardLive: false,
  }
}

const ORDER = "rnbqkbnrpppppppp"
export function spawnActors(): Actor[] {
  const actors: Actor[] = []
  const counts: Record<string, number> = {}
  const place = (color: Color, rank: number, spec: string) => {
    for (let f = 0; f < 8; f++) {
      const type = spec[f] as PieceSymbol
      const key = color + type
      const n = counts[key] ?? 0
      counts[key] = n + 1
      const square = String.fromCharCode(97 + f) + String(rank)
      actors.push(makeActor(`${key}${n}`, type, color, square))
    }
  }
  place("w", 1, ORDER)
  place("w", 2, "pppppppp")
  place("b", 7, "pppppppp")
  place("b", 8, ORDER)
  return actors
}

export type PieceSnap = {
  id: string
  type: PieceSymbol
  square: string
  dying: boolean
  gone: boolean
  yielded: boolean
}

export function snapshotPieces(actors: Actor[]): PieceSnap[] {
  return actors.map((a) => ({
    id: a.id,
    type: a.type,
    square: a.square,
    dying: a.dying,
    gone: a.gone,
    yielded: a.yielded,
  }))
}

export function applyPieceSnap(actors: Actor[], snaps: PieceSnap[]) {
  for (const snap of snaps) {
    const actor = actors.find((a) => a.id === snap.id)
    if (!actor) continue
    actor.type = snap.type
    actor.square = snap.square
    actor.dying = snap.dying
    actor.gone = snap.gone
    actor.yielded = snap.yielded
    actor.flash = 0
    actor.shardLive = false
    actor.pose = emptyPose()
    if (snap.yielded) actor.pose.yield = 1
    for (const shard of actor.shards) shard.on = false
    if (snap.square) {
      const p = squareToVec(snap.square)
      actor.pos.x = p[0]
      actor.pos.y = 0
      actor.pos.z = p[2]
      actor.yaw = homeYaw(actor.color)
    }
  }
}
