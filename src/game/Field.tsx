import { useEffect, useMemo, useRef, type ReactNode } from "react"
import { useFrame } from "@react-three/fiber"
import type { Mesh } from "three"
import * as THREE from "three"
import { Chess } from "chess.js"
import { ActorView } from "./ActorMesh"
import { FLOOR, STEP } from "./actors"
import { battle } from "./director"
import { useMats } from "./materials"
import { palette } from "./theme"
import { useGame } from "./store"

function labelTexture(text: string) {
  const canvas = document.createElement("canvas")
  canvas.width = 128
  canvas.height = 128
  const g = canvas.getContext("2d")
  if (!g) return null
  g.clearRect(0, 0, 128, 128)
  g.fillStyle = palette.muted
  g.font = "600 78px Georgia"
  g.textAlign = "center"
  g.textBaseline = "middle"
  g.fillText(text, 64, 68)
  const tex = new THREE.CanvasTexture(canvas)
  tex.anisotropy = 4
  return tex
}

function Tile({ file, rank }: { file: number; rank: number }) {
  const mats = useMats()
  const square = `${String.fromCharCode(97 + file)}${rank + 1}`
  const x = (file - 3.5) * STEP
  const z = (3.5 - rank) * STEP
  const light = (file + rank) % 2 === 1
  const scorch = (file * 3 + rank * 5) % 7 === 0
  return (
    <group position={[x, 0, z]}>
      <mesh
        position={[0, 0.207, 0]}
        material={light ? mats.tileLight : mats.tileDark}
        receiveShadow
        dispose={null}
        onClick={(e) => {
          e.stopPropagation()
          useGame.getState().pick(square)
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          document.body.style.cursor = "pointer"
        }}
        onPointerOut={() => {
          document.body.style.cursor = "grab"
        }}
      >
        <boxGeometry args={[STEP * 1.04, 0.046, STEP * 1.04]} />
      </mesh>
      {scorch && (
        <mesh position={[0.08, 0.24, -0.06]} rotation={[-Math.PI / 2, 0, 0.4]} material={mats.mud} dispose={null}>
          <circleGeometry args={[0.18, 8]} />
        </mesh>
      )}
    </group>
  )
}

function Hints() {
  const mats = useMats()
  const legal = useGame((s) => s.legal)
  const selected = useGame((s) => s.selected)
  const lastFrom = useGame((s) => s.lastFrom)
  const lastTo = useGame((s) => s.lastTo)
  const check = useGame((s) => s.check)
  const turn = useGame((s) => s.turn)
  const battleId = useGame((s) => s.battleId)
  void battleId

  const king = check
    ? battle.actors.find((a) => a.type === "k" && a.color === turn && !a.dying && a.square)
    : null

  const mark = (square: string, key: string, node: ReactNode) => {
    const file = square.charCodeAt(0) - 97
    const rank = Number(square[1]) - 1
    const x = (file - 3.5) * STEP
    const z = (3.5 - rank) * STEP
    return (
      <group key={key} position={[x, 0.25, z]}>
        {node}
      </group>
    )
  }

  return (
    <>
      {lastFrom &&
        mark(
          lastFrom,
          "lf",
          <mesh rotation={[-Math.PI / 2, 0, 0]} material={mats.last} dispose={null}>
            <planeGeometry args={[STEP, STEP]} />
          </mesh>,
        )}
      {lastTo &&
        mark(
          lastTo,
          "lt",
          <mesh rotation={[-Math.PI / 2, 0, 0]} material={mats.last} dispose={null}>
            <planeGeometry args={[STEP, STEP]} />
          </mesh>,
        )}
      {selected &&
        mark(
          selected,
          "sel",
          <mesh rotation={[-Math.PI / 2, 0, 0]} material={mats.ring} dispose={null}>
            <ringGeometry args={[0.38, 0.48, 28]} />
          </mesh>,
        )}
      {king?.square &&
        mark(
          king.square,
          "chk",
          <mesh rotation={[-Math.PI / 2, 0, 0]} material={mats.ring} dispose={null}>
            <ringGeometry args={[0.42, 0.5, 28]} />
          </mesh>,
        )}
      {legal.map((m) =>
        mark(
          m.to,
          m.to,
          m.capture ? (
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              material={mats.ring}
              dispose={null}
              onClick={(e) => {
                e.stopPropagation()
                useGame.getState().pick(m.to)
              }}
            >
              <ringGeometry args={[0.34, 0.46, 24]} />
            </mesh>
          ) : (
            <mesh
              position={[0, 0.02, 0]}
              material={mats.dot}
              dispose={null}
              onClick={(e) => {
                e.stopPropagation()
                useGame.getState().pick(m.to)
              }}
            >
              <sphereGeometry args={[0.1, 12, 10]} />
            </mesh>
          ),
        ),
      )}
    </>
  )
}

function PillarFire({ position }: { position: [number, number, number] }) {
  const mats = useMats()
  const flame = useRef<Mesh>(null)
  const inner = useRef<Mesh>(null)
  const light = useRef<THREE.PointLight>(null)
  useFrame(() => {
    const t = battle.clock * 6 + position[0] * 0.6 + position[2]
    const flick = 0.84 + Math.sin(t) * 0.13 + Math.sin(t * 2.7) * 0.06
    if (flame.current) {
      flame.current.scale.set(0.9, flick, 0.9)
      flame.current.position.y = 2.42 + flick * 0.05
    }
    if (inner.current) {
      inner.current.scale.set(0.6, flick * 0.9, 0.6)
      inner.current.position.y = 2.34 + flick * 0.04
    }
    if (light.current) light.current.intensity = 3.4 + flick * 2.4
  })
  return (
    <group position={position}>
      <mesh position={[0, 0.1, 0]} material={mats.slab} castShadow dispose={null}>
        <boxGeometry args={[0.9, 0.2, 0.9]} />
      </mesh>
      <mesh position={[0, 1.12, 0]} material={mats.darkTrim} castShadow dispose={null}>
        <boxGeometry args={[0.52, 1.84, 0.52]} />
      </mesh>
      <mesh position={[0, 2.08, 0]} material={mats.slab} dispose={null}>
        <boxGeometry args={[0.74, 0.14, 0.74]} />
      </mesh>
      <mesh position={[0, 2.22, 0]} material={mats.dark} dispose={null}>
        <cylinderGeometry args={[0.42, 0.3, 0.16, 12]} />
      </mesh>
      <mesh position={[0, 2.3, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.gold} dispose={null}>
        <torusGeometry args={[0.4, 0.035, 6, 16]} />
      </mesh>
      <mesh position={[0, 2.2, 0]} material={mats.ember} dispose={null}>
        <cylinderGeometry args={[0.22, 0.22, 0.04, 10]} />
      </mesh>
      <mesh ref={flame} position={[0, 2.46, 0]} material={mats.flame} dispose={null}>
        <coneGeometry args={[0.16, 0.5, 7]} />
      </mesh>
      <mesh ref={inner} position={[0.04, 2.36, 0]} material={mats.flame} dispose={null}>
        <coneGeometry args={[0.08, 0.3, 6]} />
      </mesh>
      <pointLight ref={light} position={[0, 2.55, 0]} color={palette.torch} distance={9.5} decay={2} intensity={4} />
    </group>
  )
}

function Chamber() {
  const mats = useMats()
  const posts = useMemo(
    () =>
      [
        [-11.5, -7],
        [11.5, -7],
        [-11.5, 7],
        [11.5, 7],
        [-7, -12.2],
        [7, -12.2],
        [-7, 12.2],
        [7, 12.2],
        [0, -13],
        [0, 13],
      ] as const,
    [],
  )
  return (
    <group>
      {posts.map(([x, z], i) => (
        <mesh key={i} position={[x, 2.6, z]} material={i % 2 ? mats.dark : mats.darkTrim} dispose={null}>
          <boxGeometry args={[0.85, 5.2, 0.85]} />
        </mesh>
      ))}
      <mesh position={[0, 1.1, -13.4]} material={mats.darkTrim} dispose={null}>
        <boxGeometry args={[16, 2.2, 0.6]} />
      </mesh>
      <mesh position={[0, 1.1, 13.4]} material={mats.darkTrim} dispose={null}>
        <boxGeometry args={[16, 2.2, 0.6]} />
      </mesh>
    </group>
  )
}

function Labels({ flipped }: { flipped: boolean }) {
  const files = "abcdefgh"
  const textures = useMemo(() => {
    const map = new Map<string, THREE.CanvasTexture>()
    for (const ch of files) {
      const tex = labelTexture(ch)
      if (tex) map.set(ch, tex)
    }
    for (let r = 1; r <= 8; r++) {
      const tex = labelTexture(String(r))
      if (tex) map.set(String(r), tex)
    }
    return map
  }, [])
  const yaw = flipped ? Math.PI : 0
  const edge = STEP * 4 + 0.15
  return (
    <group>
      {files.split("").map((ch, i) => {
        const tex = textures.get(ch)
        if (!tex) return null
        const x = (i - 3.5) * STEP
        return (
          <mesh key={ch} position={[x, FLOOR + 0.02, edge]} rotation={[-Math.PI / 2, yaw, 0]} dispose={null}>
            <planeGeometry args={[0.38, 0.38]} />
            <meshBasicMaterial map={tex} transparent toneMapped={false} />
          </mesh>
        )
      })}
      {Array.from({ length: 8 }, (_, i) => {
        const tex = textures.get(String(i + 1))
        if (!tex) return null
        const z = (3.5 - i) * STEP
        return (
          <mesh key={i} position={[-edge, FLOOR + 0.02, z]} rotation={[-Math.PI / 2, yaw, 0]} dispose={null}>
            <planeGeometry args={[0.38, 0.38]} />
            <meshBasicMaterial map={tex} transparent toneMapped={false} />
          </mesh>
        )
      })}
    </group>
  )
}

const UNDER_TEX = 1024
const UNDER_FULL = (STEP * 4 + 1.5) * 2

function underSquare(uv: THREE.Vector2) {
  const play = STEP * 8
  const inset = ((1 - play / UNDER_FULL) / 2) * UNDER_TEX
  const cell = (play / UNDER_FULL) * (UNDER_TEX / 8)
  const px = uv.x * UNDER_TEX
  const py = (1 - uv.y) * UNDER_TEX
  const file = Math.floor((px - inset) / cell)
  const rank = 7 - Math.floor((py - inset) / cell)
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null
  return `${"abcdefgh"[file]}${rank + 1}`
}

function strokeFill(g: CanvasRenderingContext2D) {
  g.fill()
  g.stroke()
}

function drawWizard(g: CanvasRenderingContext2D, type: string, pale: boolean, cx: number, cy: number, size: number) {
  const s = size * 0.82
  g.save()
  g.translate(cx, cy)
  g.scale(s / 64, s / 64)
  g.translate(-32, -34)
  g.lineJoin = "round"
  g.lineCap = "round"
  g.lineWidth = 3.2
  g.fillStyle = pale ? "#221c16" : "#f4efe6"
  g.strokeStyle = pale ? "#f7f1e6" : "#1a140f"
  if (type === "p") {
    g.beginPath()
    g.moveTo(46, 4)
    g.lineTo(51, 14)
    g.lineTo(41, 14)
    g.closePath()
    strokeFill(g)
    g.beginPath()
    g.moveTo(46, 14)
    g.lineTo(46, 56)
    g.stroke()
    g.beginPath()
    g.ellipse(18, 36, 8, 11, 0, 0, Math.PI * 2)
    strokeFill(g)
    g.beginPath()
    g.moveTo(22, 24)
    g.lineTo(40, 22)
    g.lineTo(44, 56)
    g.lineTo(18, 56)
    g.closePath()
    strokeFill(g)
    g.beginPath()
    g.arc(31, 16, 8, 0, Math.PI * 2)
    strokeFill(g)
  } else if (type === "n") {
    g.beginPath()
    g.moveTo(6, 50)
    g.lineTo(12, 34)
    g.lineTo(24, 30)
    g.lineTo(30, 14)
    g.lineTo(44, 12)
    g.lineTo(52, 20)
    g.lineTo(48, 26)
    g.lineTo(38, 24)
    g.lineTo(36, 32)
    g.lineTo(56, 38)
    g.lineTo(52, 50)
    g.lineTo(40, 50)
    g.lineTo(38, 42)
    g.lineTo(20, 42)
    g.lineTo(16, 50)
    g.closePath()
    strokeFill(g)
    g.beginPath()
    g.arc(46, 18, 1.6, 0, Math.PI * 2)
    g.fill()
  } else if (type === "b") {
    g.beginPath()
    g.moveTo(50, 8)
    g.lineTo(54, 56)
    g.stroke()
    g.beginPath()
    g.moveTo(32, 4)
    g.lineTo(20, 22)
    g.lineTo(44, 22)
    g.closePath()
    strokeFill(g)
    g.beginPath()
    g.moveTo(22, 24)
    g.lineTo(42, 24)
    g.lineTo(46, 56)
    g.lineTo(18, 56)
    g.closePath()
    strokeFill(g)
  } else if (type === "r") {
    g.beginPath()
    g.moveTo(14, 18)
    g.lineTo(14, 8)
    g.lineTo(24, 8)
    g.lineTo(24, 16)
    g.lineTo(34, 16)
    g.lineTo(34, 8)
    g.lineTo(44, 8)
    g.lineTo(44, 16)
    g.lineTo(50, 16)
    g.lineTo(50, 56)
    g.lineTo(14, 56)
    g.closePath()
    strokeFill(g)
    g.beginPath()
    g.arc(24, 34, 2.2, 0, Math.PI * 2)
    g.arc(38, 34, 2.2, 0, Math.PI * 2)
    g.fill()
  } else if (type === "q") {
    g.beginPath()
    g.moveTo(48, 6)
    g.lineTo(52, 50)
    g.stroke()
    g.beginPath()
    g.moveTo(10, 20)
    g.lineTo(16, 6)
    g.lineTo(22, 20)
    g.lineTo(32, 4)
    g.lineTo(42, 20)
    g.lineTo(48, 8)
    g.lineTo(50, 20)
    g.lineTo(46, 56)
    g.lineTo(16, 56)
    g.closePath()
    strokeFill(g)
  } else {
    g.beginPath()
    g.moveTo(30, 2)
    g.lineTo(34, 2)
    g.lineTo(34, 8)
    g.lineTo(42, 8)
    g.lineTo(42, 12)
    g.lineTo(34, 12)
    g.lineTo(34, 18)
    g.lineTo(30, 18)
    g.lineTo(30, 12)
    g.lineTo(22, 12)
    g.lineTo(22, 8)
    g.lineTo(30, 8)
    g.closePath()
    strokeFill(g)
    g.beginPath()
    g.moveTo(16, 22)
    g.lineTo(48, 22)
    g.lineTo(46, 56)
    g.lineTo(18, 56)
    g.closePath()
    strokeFill(g)
  }
  g.restore()
}

function underBoardTexture(
  fen: string,
  selected: string | null,
  legal: { to: string; capture: boolean }[],
  lastFrom: string | null,
  lastTo: string | null,
) {
  const size = UNDER_TEX
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const g = canvas.getContext("2d")
  if (!g) return null
  const play = STEP * 8
  const inset = ((1 - play / UNDER_FULL) / 2) * size
  const cell = (play / UNDER_FULL) * (size / 8)
  g.fillStyle = "#241e18"
  g.fillRect(0, 0, size, size)
  g.strokeStyle = "#c6a15a"
  g.lineWidth = 8
  g.strokeRect(inset - 10, inset - 10, (play / UNDER_FULL) * size + 20, (play / UNDER_FULL) * size + 20)
  const game = new Chess(fen)
  const files = "abcdefgh"
  const marks = new Map<string, string>()
  if (lastFrom) marks.set(lastFrom, "rgba(226,160,74,0.35)")
  if (lastTo) marks.set(lastTo, "rgba(226,160,74,0.45)")
  if (selected) marks.set(selected, "rgba(226,160,74,0.55)")
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const x = inset + file * cell
      const y = inset + (7 - rank) * cell
      const id = `${files[file]}${rank + 1}`
      const light = (file + rank) % 2 === 1
      g.fillStyle = light ? "#eadcc8" : "#3f3832"
      g.fillRect(x, y, cell + 0.6, cell + 0.6)
      const mark = marks.get(id)
      if (mark) {
        g.fillStyle = mark
        g.fillRect(x, y, cell + 0.6, cell + 0.6)
      }
      const piece = game.get(id as "a1")
      if (!piece) continue
      drawWizard(g, piece.type, piece.color === "w", x + cell / 2, y + cell / 2, cell)
    }
  }
  for (const move of legal) {
    const file = move.to.charCodeAt(0) - 97
    const rank = Number(move.to[1]) - 1
    const x = inset + (file + 0.5) * cell
    const y = inset + (7 - rank + 0.5) * cell
    g.beginPath()
    g.strokeStyle = move.capture ? "rgba(196,64,42,0.95)" : "rgba(226,160,74,0.95)"
    g.lineWidth = move.capture ? cell * 0.08 : cell * 0.12
    g.arc(x, y, move.capture ? cell * 0.28 : cell * 0.1, 0, Math.PI * 2)
    g.stroke()
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

function UnderBoard() {
  const fen = useGame((s) => s.fen)
  const selected = useGame((s) => s.selected)
  const legal = useGame((s) => s.legal)
  const lastFrom = useGame((s) => s.lastFrom)
  const lastTo = useGame((s) => s.lastTo)
  const tex = useMemo(
    () => underBoardTexture(fen, selected, legal, lastFrom, lastTo),
    [fen, selected, legal, lastFrom, lastTo],
  )
  useEffect(() => {
    return () => tex?.dispose()
  }, [tex])
  if (!tex) return null
  return (
    <mesh
      position={[0, -0.06, 0]}
      rotation={[Math.PI / 2, 0, 0]}
      dispose={null}
      onClick={(e) => {
        e.stopPropagation()
        const uv = e.uv
        if (!uv) return
        const square = underSquare(uv)
        if (square) useGame.getState().pick(square)
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        document.body.style.cursor = "pointer"
      }}
      onPointerOut={() => {
        document.body.style.cursor = "grab"
      }}
    >
      <planeGeometry args={[UNDER_FULL, UNDER_FULL]} />
      <meshBasicMaterial map={tex} toneMapped={false} side={THREE.DoubleSide} />
    </mesh>
  )
}

export function Field({ flipped }: { flipped: boolean }) {
  const mats = useMats()
  const slab = STEP * 4 + 1.5
  const corner = STEP * 4 + 0.86
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} material={mats.dark} receiveShadow dispose={null}>
        <circleGeometry args={[22, 48]} />
      </mesh>
      <mesh position={[0, 0.11, 0]} material={mats.slab} receiveShadow dispose={null}>
        <boxGeometry args={[slab * 2, 0.18, slab * 2]} />
      </mesh>
      <UnderBoard />
      {Array.from({ length: 8 }, (_, rank) =>
        Array.from({ length: 8 }, (_, file) => <Tile key={`${file}${rank}`} file={file} rank={rank} />),
      )}
      <Hints />
      <Labels flipped={flipped} />
      <PillarFire position={[-corner, 0.2, -corner]} />
      <PillarFire position={[corner, 0.2, -corner]} />
      <PillarFire position={[-corner, 0.2, corner]} />
      <PillarFire position={[corner, 0.2, corner]} />
      <Chamber />
    </>
  )
}

export function Actors() {
  const epoch = useGame((s) => s.epoch)
  void epoch
  return (
    <>
      {battle.actors.map((actor) => (
        <ActorSlot key={actor.id + actor.type} id={actor.id} />
      ))}
    </>
  )
}

function ActorSlot({ id }: { id: string }) {
  const actor = battle.actors.find((a) => a.id === id)
  if (!actor) return null
  return <ActorView actor={actor} />
}

