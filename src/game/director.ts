import type { Color, Move, PieceSymbol } from "chess.js"
import { sfx } from "./audio"
import {
  FLOOR,
  type Actor,
  applyPieceSnap,
  emptyPose,
  homeYaw,
  snapshotPieces,
  spawnActors,
  squareToVec,
  type PieceSnap,
} from "./actors"

export type MoveStep = {
  k: "move"
  id: string
  from: [number, number, number]
  to: [number, number, number]
  dur: number
  arc: number
  stepMark: number
  impactId?: string
  fired?: boolean
}

export type Step =
  | MoveStep
  | { k: "parallel"; moves: MoveStep[] }
  | {
      k: "strike"
      id: string
      victimId?: string
      dur: number
      from: [number, number, number]
      to: [number, number, number]
      fired: boolean
      swung: boolean
      clashed: boolean
    }
  | { k: "wait"; dur: number }
  | { k: "yield"; id: string; dur: number }
  | { k: "promote"; id: string; type: "q" | "r" | "b" | "n" }

type Playback = { steps: Step[]; i: number; t: number }

export const battle = {
  actors: spawnActors(),
  play: null as Playback | null,
  onDone: null as null | (() => void),
  onPromote: null as null | (() => void),
  token: 0,
  shake: 0,
  freeze: 0,
  clock: 0,
  selectedId: null as string | null,
  reduce: false,
  job: 0,
}

function pace(n: number) {
  return n * (battle.reduce ? 0.22 : 1)
}

function byId(id: string) {
  return battle.actors.find((a) => a.id === id)
}

function actorOn(square: string) {
  return battle.actors.find((a) => a.square === square && !a.dying && !a.gone)
}

export function resetActors() {
  battle.actors = spawnActors()
  battle.play = null
  battle.onDone = null
  battle.token++
  battle.shake = 0
  battle.freeze = 0
  battle.selectedId = null
}

export function piecesNow(): PieceSnap[] {
  return snapshotPieces(battle.actors)
}

export function restorePieces(snaps: PieceSnap[]) {
  applyPieceSnap(battle.actors, snaps)
  battle.play = null
  battle.onDone = null
  battle.token++
  battle.shake = 0
  battle.freeze = 0
  battle.selectedId = null
}

function ease(u: number) {
  return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2
}

export function planMove(move: Move): Step[] {
  const steps: Step[] = []
  const mover = actorOn(move.from)
  if (!mover) return steps
  const from = squareToVec(move.from)
  const dest = squareToVec(move.to)
  const dx = dest[0] - from[0]
  const dz = dest[2] - from[2]
  const len = Math.hypot(dx, dz) || 1
  const nx = dx / len
  const nz = dz / len
  const castle = move.flags.includes("k") || move.flags.includes("q")

  if (castle) {
    const rank = move.from[1]
    const kingside = move.flags.includes("k")
    const rookFromSq = `${kingside ? "h" : "a"}${rank}`
    const rookToSq = `${kingside ? "f" : "d"}${rank}`
    const rook = actorOn(rookFromSq)
    mover.square = move.to
    if (rook) {
      rook.square = rookToSq
      steps.push({
        k: "parallel",
        moves: [
          { k: "move", id: mover.id, from, to: dest, dur: pace(0.82), arc: 0, stepMark: -1 },
          {
            k: "move",
            id: rook.id,
            from: squareToVec(rookFromSq),
            to: squareToVec(rookToSq),
            dur: pace(0.82),
            arc: 0,
            stepMark: -1,
          },
        ],
      })
    }
  } else if (move.captured) {
    const victimSq = move.flags.includes("e") ? `${move.to[0]}${move.from[1]}` : move.to
    const victim = actorOn(victimSq)
    mover.square = move.to
    if (victim && victim.id !== mover.id) {
      victim.square = ""
      victim.dying = true
      const gap = move.piece === "n" ? 0.46 : 0.52
      const stop: [number, number, number] = [dest[0] - nx * gap, 0, dest[2] - nz * gap]
      const arc = move.piece === "n" ? 0.78 : 0
      const dur = pace(Math.min(0.95, 0.34 + len * 0.09) * (move.piece === "n" ? 0.9 : 1))
      steps.push({ k: "move", id: mover.id, from, to: stop, dur, arc, stepMark: -1 })
      steps.push({
        k: "strike",
        id: mover.id,
        victimId: victim.id,
        dur: pace(2),
        from: stop,
        to: dest,
        fired: false,
        swung: false,
        clashed: false,
      })
      steps.push({ k: "wait", dur: pace(0.28) })
    } else {
      steps.push({
        k: "move",
        id: mover.id,
        from,
        to: dest,
        dur: pace(0.45),
        arc: move.piece === "n" ? 0.6 : 0,
        stepMark: -1,
      })
    }
  } else {
    mover.square = move.to
    const arc = move.piece === "n" ? 0.62 : 0
    const dur = pace(Math.min(0.9, 0.32 + len * 0.085))
    steps.push({ k: "move", id: mover.id, from, to: dest, dur, arc, stepMark: -1 })
  }

  if (move.promotion === "q" || move.promotion === "r" || move.promotion === "b" || move.promotion === "n") {
    steps.push({ k: "promote", id: mover.id, type: move.promotion })
  }
  return steps
}

export function mateYield(loser: Color): Step | null {
  const king = battle.actors.find((a) => a.type === "k" && a.color === loser && !a.dying && !a.gone)
  if (!king) return null
  return { k: "yield", id: king.id, dur: pace(0.85) }
}

export function startPlayback(steps: Step[], onDone: () => void) {
  const token = battle.token
  battle.play = { steps, i: 0, t: 0 }
  battle.onDone = () => {
    if (token !== battle.token) return
    onDone()
  }
  if (!steps.length) finish()
}

function writeWalk(actor: Actor, dt: number) {
  actor.cycle += dt * (actor.type === "n" ? 11 : actor.type === "r" ? 7 : 8.5)
  const w = actor.cycle
  const pose = actor.pose
  pose.dead = 0
  pose.yield = 0
  pose.strike = 0
  pose.wind = 0
  pose.lunge = 0
  if (actor.type === "n") {
    pose.legFL = Math.sin(w) * 0.75
    pose.legFR = Math.sin(w + Math.PI) * 0.75
    pose.legBL = Math.sin(w + Math.PI) * 0.65
    pose.legBR = Math.sin(w) * 0.65
    pose.bob = Math.abs(Math.sin(w)) * 0.06
    pose.neck = Math.sin(w) * 0.1
    pose.lean = 0.18
    pose.armR = 0.4
    return
  }
  pose.legL = Math.sin(w) * 0.7
  pose.legR = Math.sin(w + Math.PI) * 0.7
  pose.armL = Math.sin(w + Math.PI) * 0.45
  pose.armR = Math.sin(w) * 0.4
  pose.bob = Math.abs(Math.sin(w)) * (actor.type === "r" ? 0.05 : 0.035)
  pose.lean = actor.type === "r" ? 0.16 : 0.12
  pose.twist = 0
  pose.neck = 0
}

function writeStrike(actor: Actor, u: number) {
  const wind =
    u < 0.28 ? u / 0.28 : u < 0.42 ? 1 - (u - 0.28) / 0.14 : u < 0.58 ? (u - 0.42) / 0.16 : u < 0.78 ? 1 - (u - 0.58) / 0.2 : 0
  const strike =
    u < 0.28 ? 0 : u < 0.42 ? (u - 0.28) / 0.14 : u < 0.58 ? 1 - (u - 0.42) / 0.16 : u < 0.78 ? (u - 0.58) / 0.2 : Math.max(0, 1 - (u - 0.78) / 0.22)
  const pose = actor.pose
  pose.wind = wind
  pose.strike = strike
  pose.dead = 0
  pose.yield = 0
  pose.bob = 0
  if (actor.type === "n") {
    pose.legFL = -1.15 * wind + 0.55 * strike
    pose.legFR = -1.15 * wind + 0.55 * strike
    pose.legBL = 0.35 * wind
    pose.legBR = 0.35 * wind
    pose.neck = -0.45 * wind + 0.2 * strike
    pose.lean = -0.35 * wind + 0.4 * strike
    pose.lunge = strike * 0.18
    pose.armR = -0.9 * strike
    pose.twist = 0
    return
  }
  if (actor.type === "p") {
    pose.armR = -0.25 * wind - 1.35 * strike
    pose.armL = 0.35
    pose.lean = -0.2 * wind + 0.4 * strike
    pose.lunge = strike * 0.42
    pose.legL = 0.35 * strike
    pose.legR = -0.12
    pose.neck = -0.15 * wind + 0.2 * strike
    pose.twist = 0
    return
  }
  if (actor.type === "r") {
    pose.armR = -1.7 * wind + 0.45 * strike
    pose.armL = -1.2 * wind + 0.25 * strike
    pose.lean = -0.28 * wind + 0.62 * strike
    pose.lunge = strike * 0.5
    pose.legL = 0.4 * strike
    pose.legR = 0.18 * strike
    pose.neck = 0.3 * strike
    pose.twist = 0
    return
  }
  if (actor.type === "b") {
    pose.armR = -2.1 * wind + 0.55 * strike
    pose.armL = 0.25
    pose.lean = -0.35 * wind + 0.45 * strike
    pose.lunge = strike * 0.28
    pose.twist = 0.15 * wind
    pose.legL = 0.2 * strike
    pose.legR = -0.08
    pose.neck = -0.35 * wind + 0.4 * strike
    return
  }
  if (actor.type === "q") {
    pose.armR = -0.4 * wind - 1.8 * strike
    pose.armL = 0.8 * wind - 0.6 * strike
    pose.twist = 1.7 * (wind - strike)
    pose.lean = -0.15 * wind + 0.22 * strike
    pose.lunge = strike * 0.2
    pose.legL = 0.18 * strike
    pose.legR = -0.28 * wind
    pose.neck = 0.15 * strike
    return
  }
  pose.armR = -1.6 * wind + 0.3 * strike
  pose.armL = -1.1 * wind
  pose.twist = 0.15 * wind
  pose.lean = -0.45 * wind + 0.7 * strike
  pose.lunge = strike * 0.16
  pose.legL = 0.15 * strike
  pose.legR = 0.15 * strike
  pose.neck = 0.35 * strike
}

function writeBrace(actor: Actor, u: number) {
  const hit = u > 0.3 && u < 0.5 ? (u - 0.3) / 0.16 : u >= 0.5 && u < 0.7 ? 1 - (u - 0.5) / 0.2 : 0
  const pose = actor.pose
  pose.lean = -0.45 * hit
  pose.lunge = -0.16 * hit
  pose.armL = 0.9 * hit
  pose.armR = 0.7 * hit
  pose.neck = -0.25 * hit
}

function writeYield(actor: Actor, u: number) {
  const pose = actor.pose
  pose.yield = u
  pose.legL = -1.2 * u
  pose.legR = -1.2 * u
  pose.lean = 0.65 * u
  pose.bob = -0.08 * u
  pose.armL = 0.5 * u
  pose.armR = 0.9 * u
  pose.lunge = 0
  pose.strike = 0
  pose.twist = 0.2 * u
}

function writeIdle(actor: Actor) {
  if (actor.yielded) {
    writeYield(actor, 1)
    return
  }
  const w = battle.clock * 1.7 + actor.seed
  const pose = emptyPose()
  pose.bob = Math.sin(w) * 0.018 + (battle.selectedId === actor.id ? 0.055 : 0)
  pose.legL = Math.sin(w) * 0.06
  pose.legR = -Math.sin(w) * 0.06
  pose.armL = Math.sin(w * 0.5) * 0.05
  pose.armR = -Math.sin(w * 0.5) * 0.04
  pose.neck = Math.sin(w * 0.7) * (actor.type === "n" ? 0.08 : 0.05)
  if (actor.type === "n") {
    pose.legFL = Math.sin(w) * 0.05
    pose.legFR = -Math.sin(w) * 0.05
  }
  actor.pose = pose
  const target = homeYaw(actor.color)
  let d = target - actor.yaw
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  actor.yaw += d * 0.08
  if (actor.square) {
    const p = squareToVec(actor.square)
    actor.pos.x = p[0]
    actor.pos.y = 0
    actor.pos.z = p[2]
  }
}

function fightMove(type: string, u: number) {
  if (type === "p") {
    const t = u < 0.32 ? 0 : u < 0.48 ? (u - 0.32) / 0.16 : 1
    return { t, lift: 0, spin: 0 }
  }
  if (type === "n") {
    const t = u < 0.28 ? 0 : u < 0.62 ? (u - 0.28) / 0.34 : 1
    const lift = u > 0.28 && u < 0.7 ? Math.sin(((u - 0.28) / 0.42) * Math.PI) * 0.95 : 0
    return { t, lift, spin: 0 }
  }
  if (type === "b") {
    const t = u < 0.4 ? (u / 0.4) * 0.3 : u < 0.64 ? 0.3 + ((u - 0.4) / 0.24) * 0.7 : 1
    const lift = u > 0.42 && u < 0.68 ? Math.sin(((u - 0.42) / 0.26) * Math.PI) * 0.28 : 0
    return { t, lift, spin: 0.35 }
  }
  if (type === "r") {
    const t = u < 0.18 ? 0 : u < 0.52 ? ((u - 0.18) / 0.34) ** 1.5 * 1.32 : 1.32 - ((u - 0.52) / 0.48) * 0.32
    return { t, lift: 0, spin: 0 }
  }
  if (type === "q") {
    const t = u < 0.2 ? 0.1 : u < 0.78 ? 0.1 + ((u - 0.2) / 0.58) * 0.9 : 1
    return { t, lift: 0, spin: Math.sin(u * Math.PI * 2) * 1.15 }
  }
  const t = u < 0.42 ? 0 : u < 0.6 ? (u - 0.42) / 0.18 : 1
  return { t, lift: 0, spin: 0 }
}

function killAt(type: string) {
  if (type === "p") return 0.46
  if (type === "r") return 0.5
  if (type === "n" || type === "b") return 0.62
  if (type === "k") return 0.58
  return 0.74
}

function shatter(victim: Actor | undefined, attacker: Actor | undefined) {
  if (!victim) return
  victim.pose.dead = 1
  victim.flash = 1
  victim.shardLive = true
  const base = victim.pos
  const kind = attacker?.type ?? "p"
  const face = attacker ? attacker.yaw : 0
  const fx = Math.sin(face)
  const fz = Math.cos(face)
  const px = -fz
  const pz = fx
  const heavy = victim.type === "r" ? 1.45 : victim.type === "q" || victim.type === "k" ? 1.2 : victim.type === "p" ? 0.7 : 1
  victim.shards.forEach((shard, i) => {
    const spread = (i / victim.shards.length) * Math.PI * 2 + victim.seed
    let vx = Math.cos(spread)
    let vz = Math.sin(spread)
    let vy = 1.4
    let s = 0.08 * heavy
    let spin = 6
    if (kind === "p") {
      vx = fx * (2.1 + (i % 3) * 0.35) + Math.cos(spread) * 0.4
      vz = fz * (2.1 + (i % 3) * 0.35) + Math.sin(spread) * 0.4
      vy = 0.7 + (i % 4) * 0.2
      s = 0.045 * heavy
    } else if (kind === "n") {
      vx = Math.cos(spread) * (2.6 + (i % 2) * 0.8)
      vz = Math.sin(spread) * (2.6 + (i % 2) * 0.8)
      vy = 0.35 + (i % 3) * 0.18
      s = 0.1 * heavy
      spin = 4
    } else if (kind === "b") {
      vx = Math.cos(spread) * 0.65
      vz = Math.sin(spread) * 0.65
      vy = 3.6 + (i % 4) * 0.45
      s = 0.07 * heavy
      spin = 9
    } else if (kind === "r") {
      vx = fx * (3.8 + (i % 3) * 0.6)
      vz = fz * (3.8 + (i % 3) * 0.6)
      vy = 0.9
      s = 0.15 * heavy
      spin = 3
    } else if (kind === "q") {
      vx = px * Math.cos(spread) * 3.1
      vz = pz * Math.cos(spread) * 3.1
      vy = 0.45 + (i % 3) * 0.12
      s = 0.055 * heavy
      spin = 14
    } else {
      vx = Math.cos(spread) * 0.85
      vz = Math.sin(spread) * 0.85
      vy = 1.5 + (i % 3) * 0.2
      s = 0.12 * heavy
      spin = 2.5
    }
    shard.on = true
    shard.x = base.x + vx * 0.02
    shard.y = FLOOR + 0.3 + (i % 4) * 0.05
    shard.z = base.z + vz * 0.02
    shard.vx = vx
    shard.vz = vz
    shard.vy = vy
    shard.rx = i * 0.4
    shard.ry = i * 0.7
    shard.vrx = (i % 2 ? spin : -spin)
    shard.vry = spin * 0.6
    shard.s = s
  })
  const weight = kind === "r" ? 1 : kind === "q" || kind === "n" ? 0.75 : kind === "k" ? 0.65 : 0.4
  if (!battle.reduce) battle.shake = Math.max(battle.shake, weight * heavy)
  battle.freeze = battle.reduce ? 0 : kind === "r" || kind === "k" ? 0.09 : 0.05
  sfx.crack()
}

function integrateShards(actor: Actor, dt: number) {
  if (!actor.shardLive) return
  let moving = false
  for (const shard of actor.shards) {
    if (!shard.on) continue
    shard.vy -= 14 * dt
    shard.x += shard.vx * dt
    shard.y += shard.vy * dt
    shard.z += shard.vz * dt
    if (shard.y < FLOOR + shard.s * 0.5) {
      shard.y = FLOOR + shard.s * 0.5
      shard.vy *= -0.22
      shard.vx *= 0.55
      shard.vz *= 0.55
    }
    shard.rx += shard.vrx * dt
    shard.ry += shard.vry * dt
    if (Math.abs(shard.vx) + Math.abs(shard.vz) + Math.abs(shard.vy) > 0.15) moving = true
  }
  if (!moving) actor.shardLive = false
}

function steerMove(step: MoveStep, u: number, dt: number) {
  const actor = byId(step.id)
  if (!actor) return
  const e = ease(Math.min(1, u))
  actor.pos.x = step.from[0] + (step.to[0] - step.from[0]) * e
  actor.pos.z = step.from[2] + (step.to[2] - step.from[2]) * e
  actor.pos.y = Math.sin(Math.min(1, u) * Math.PI) * step.arc
  const dx = step.to[0] - step.from[0]
  const dz = step.to[2] - step.from[2]
  if (dx * dx + dz * dz > 0.0004) actor.yaw = Math.atan2(dx, dz)
  writeWalk(actor, dt)
  const mark = Math.floor(u * 4)
  if (mark > 0 && mark !== step.stepMark && u < 1) {
    step.stepMark = mark
    sfx.step()
  }
  if (step.impactId && !step.fired && u >= 0.9) {
    step.fired = true
    shatter(byId(step.impactId), actor)
  }
}

function idleExcept(busy: Set<string>, dt: number) {
  for (const actor of battle.actors) {
    if (actor.dying || actor.gone) continue
    if (busy.has(actor.id)) continue
    if (actor.flash > 0) actor.flash = Math.max(0, actor.flash - dt * 4.5)
    writeIdle(actor)
  }
}

function finish() {
  const cb = battle.onDone
  battle.play = null
  battle.onDone = null
  for (const actor of battle.actors) {
    if (actor.dying || actor.gone || !actor.square) continue
    const p = squareToVec(actor.square)
    actor.pos.x = p[0]
    actor.pos.y = 0
    actor.pos.z = p[2]
    actor.pose.lunge = 0
    actor.pose.strike = 0
  }
  cb?.()
}

function advance(play: Playback) {
  play.i += 1
  play.t = 0
  if (play.i >= play.steps.length) finish()
}

export function tickBattle(dt: number) {
  dt = Math.min(dt, 0.05)
  battle.clock += dt
  if (battle.freeze > 0) battle.freeze = Math.max(0, battle.freeze - dt)
  battle.shake = Math.max(0, battle.shake - dt * (battle.freeze > 0 ? 0.2 : 1.5))
  for (const actor of battle.actors) {
    if (actor.flash > 0 && (actor.dying || actor.pose.dead > 0)) {
      actor.flash = Math.max(0, actor.flash - dt * 3.2)
    }
    integrateShards(actor, dt)
  }
  if (battle.freeze > 0) return

  const play = battle.play
  if (!play) {
    for (const actor of battle.actors) {
      if (actor.dying || actor.gone) continue
      writeIdle(actor)
    }
    return
  }

  play.t += dt
  const step = play.steps[play.i]
  if (!step) {
    finish()
    return
  }

  if (step.k === "wait") {
    idleExcept(new Set(), dt)
    if (play.t >= step.dur) advance(play)
    return
  }

  if (step.k === "move") {
    const u = play.t / step.dur
    steerMove(step, u, dt)
    idleExcept(new Set([step.id]), dt)
    if (u >= 1) advance(play)
    return
  }

  if (step.k === "parallel") {
    let done = true
    const busy = new Set<string>()
    for (const move of step.moves) {
      busy.add(move.id)
      const u = play.t / move.dur
      steerMove(move, u, dt)
      if (u < 1) done = false
    }
    idleExcept(busy, dt)
    if (done) advance(play)
    return
  }

  if (step.k === "strike") {
    const actor = byId(step.id)
    const u = Math.min(1, play.t / step.dur)
    if (actor) {
      const move = fightMove(actor.type, u)
      const dx = step.to[0] - step.from[0]
      const dz = step.to[2] - step.from[2]
      actor.pos.x = step.from[0] + dx * move.t
      actor.pos.z = step.from[2] + dz * move.t
      actor.pos.y = move.lift
      if (dx * dx + dz * dz > 0.0004) actor.yaw = Math.atan2(dx, dz) + move.spin
      writeStrike(actor, u)
      const blow = killAt(actor.type)
      if (!step.swung && u > 0.18) {
        step.swung = true
        sfx.swing()
      }
      if (!step.clashed && u > blow - 0.06) {
        step.clashed = true
        sfx.swing()
      }
      if (!step.fired && u >= blow) {
        step.fired = true
        shatter(step.victimId ? byId(step.victimId) : undefined, actor)
      }
    }
    idleExcept(new Set(step.id ? [step.id] : []), dt)
    const victim = step.victimId ? byId(step.victimId) : undefined
    if (victim && !step.fired && !victim.gone) writeBrace(victim, u)
    if (u >= 1) {
      if (actor) {
        actor.pos.x = step.to[0]
        actor.pos.y = 0
        actor.pos.z = step.to[2]
        actor.pose.lunge = 0
      }
      advance(play)
    }
    return
  }

  if (step.k === "yield") {
    const actor = byId(step.id)
    const u = Math.min(1, play.t / step.dur)
    if (actor) writeYield(actor, u * u * (3 - 2 * u))
    idleExcept(new Set([step.id]), dt)
    if (u >= 1) {
      if (actor) actor.yielded = true
      sfx.bell()
      advance(play)
    }
    return
  }

  if (step.k === "promote") {
    const actor = byId(step.id)
    if (actor) actor.type = step.type as PieceSymbol
    sfx.bell()
    battle.onPromote?.()
    advance(play)
  }
}
