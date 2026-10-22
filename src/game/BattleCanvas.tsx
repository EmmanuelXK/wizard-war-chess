import { OrbitControls } from "@react-three/drei"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { useEffect, useRef } from "react"
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib"
import * as THREE from "three"
import { battle, tickBattle } from "./director"
import { Actors, Field } from "./Field"
import { Materials } from "./materials"
import { useGame } from "./store"

const _offset = new THREE.Vector3()
const _spherical = new THREE.Spherical()

const MIN_POLAR = 0.16
const MAX_POLAR = Math.PI - 0.38
const MIN_DIST = 7.2
const MAX_DIST = 30

function Director() {
  useFrame((_, dt) => {
    tickBattle(dt)
  })
  return null
}

function Atmosphere() {
  const { scene, gl } = useThree()
  useEffect(() => {
    scene.background = new THREE.Color("#07060b")
    scene.fog = new THREE.Fog("#07060b", 14, 32)
    gl.toneMapping = THREE.ACESFilmicToneMapping
    gl.toneMappingExposure = 1.12
    battle.reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    return () => {
      scene.fog = null
    }
  }, [scene, gl])
  return null
}

function frameCamera(camera: THREE.Camera, controls: OrbitControlsImpl, narrow: boolean) {
  const y = narrow ? 13.2 : 10.15
  const z = narrow ? 12.8 : 11.15
  const fov = narrow ? 43 : 32
  if (camera instanceof THREE.PerspectiveCamera && Math.abs(camera.fov - fov) > 0.01) {
    camera.fov = fov
    camera.updateProjectionMatrix()
  }
  const damping = controls.enableDamping
  controls.enableDamping = false
  controls.update()
  controls.enableDamping = damping
  camera.position.set(0, y, z)
  controls.target.set(0, 0.15, 0)
  controls.update()
}

function CameraRig() {
  const controls = useRef<OrbitControlsImpl>(null)
  const { camera, size, gl } = useThree()
  const nonce = useGame((s) => s.viewNonce)
  const phase = useGame((s) => s.phase)
  const moved = useRef(false)
  const seenNonce = useRef(nonce)
  const seenPhase = useRef(phase)
  const keys = useRef(new Set<string>())

  useEffect(() => {
    const el = gl.domElement
    const enter = () => {
      if (document.body.style.cursor !== "pointer" && document.body.style.cursor !== "grabbing") {
        document.body.style.cursor = "grab"
      }
    }
    const leave = () => {
      if (document.body.style.cursor === "grab") document.body.style.cursor = "default"
    }
    el.addEventListener("pointerenter", enter)
    el.addEventListener("pointerleave", leave)
    return () => {
      el.removeEventListener("pointerenter", enter)
      el.removeEventListener("pointerleave", leave)
    }
  }, [gl])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA") return
      keys.current.add(e.key.toLowerCase())
    }
    const up = (e: KeyboardEvent) => {
      keys.current.delete(e.key.toLowerCase())
    }
    const blur = () => keys.current.clear()
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    window.addEventListener("blur", blur)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
      window.removeEventListener("blur", blur)
    }
  }, [])

  useEffect(() => {
    const rig = controls.current
    if (!rig) return
    const playingFromBelow = seenPhase.current !== "anim" && phase === "anim" && camera.position.y < 0.8
    seenPhase.current = phase
    if (playingFromBelow) {
      moved.current = false
      frameCamera(camera, rig, size.width < 820)
      return
    }
    if (seenNonce.current !== nonce) {
      seenNonce.current = nonce
      moved.current = false
    }
    if (moved.current) return
    frameCamera(camera, rig, size.width < 820)
  }, [camera, nonce, phase, size.width])

  useFrame((_, dt) => {
    const rig = controls.current
    if (!rig || keys.current.size === 0) return
    const k = keys.current
    let yaw = 0
    let pitch = 0
    let zoom = 0
    if (k.has("a") || k.has("arrowleft")) yaw -= 1
    if (k.has("d") || k.has("arrowright")) yaw += 1
    if (k.has("w") || k.has("arrowup")) pitch -= 1
    if (k.has("s") || k.has("arrowdown")) pitch += 1
    if (k.has("q")) zoom -= 1
    if (k.has("e")) zoom += 1
    if (yaw === 0 && pitch === 0 && zoom === 0) return
    const cap = Math.min(dt, 0.05)
    moved.current = true
    _offset.copy(camera.position).sub(rig.target)
    _spherical.setFromVector3(_offset)
    _spherical.theta += yaw * 1.35 * cap
    _spherical.phi = THREE.MathUtils.clamp(_spherical.phi + pitch * 0.9 * cap, MIN_POLAR, MAX_POLAR)
    _spherical.radius = THREE.MathUtils.clamp(_spherical.radius + zoom * 9 * cap, MIN_DIST, MAX_DIST)
    _offset.setFromSpherical(_spherical)
    camera.position.copy(rig.target).add(_offset)
  })

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.85}
      zoomSpeed={0.75}
      panSpeed={0.65}
      minDistance={MIN_DIST}
      maxDistance={MAX_DIST}
      minPolarAngle={MIN_POLAR}
      maxPolarAngle={MAX_POLAR}
      target={[0, 0.15, 0]}
      enablePan
      screenSpacePanning
      mouseButtons={{
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      }}
      touches={{
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN,
      }}
      onStart={() => {
        moved.current = true
        document.body.style.cursor = "grabbing"
      }}
      onEnd={() => {
        document.body.style.cursor = "grab"
      }}
      onChange={() => {
        const rig = controls.current
        if (!rig) return
        rig.target.x = THREE.MathUtils.clamp(rig.target.x, -5.5, 5.5)
        rig.target.y = THREE.MathUtils.clamp(rig.target.y, 0.05, 1.4)
        rig.target.z = THREE.MathUtils.clamp(rig.target.z, -5.5, 5.5)
      }}
    />
  )
}

function Board() {
  const player = useGame((s) => s.player)
  const mode = useGame((s) => s.mode)
  const flipped = mode === "ai" && player === "b"
  const shakeRef = useRef<THREE.Group>(null)
  useFrame(() => {
    const g = shakeRef.current
    if (!g) return
    const shake = battle.shake
    const t = battle.clock
    g.position.set(Math.sin(t * 46) * shake * 0.12, Math.cos(t * 38) * shake * 0.05, Math.sin(t * 52) * shake * 0.08)
    g.rotation.z = Math.sin(t * 58) * shake * 0.012
  })
  return (
    <group ref={shakeRef}>
      <group rotation={[0, flipped ? Math.PI : 0, 0]}>
        <Field flipped={flipped} />
        <Actors />
      </group>
    </group>
  )
}

export default function BattleCanvas() {
  return (
    <Canvas
      shadows
      dpr={[1, 1.6]}
      camera={{ position: [0, 10.2, 11.2], fov: 32, near: 0.1, far: 90 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      <Atmosphere />
      <CameraRig />
      <ambientLight intensity={0.12} />
      <hemisphereLight args={["#2a3144", "#0a0808", 0.34]} />
      <directionalLight
        position={[5, 14, 7]}
        intensity={1.15}
        color={"#c8b8a0"}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={2}
        shadow-camera-far={32}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[-7, 6, -5]} intensity={0.22} color={"#6e7ea4"} />
      <Materials>
        <Director />
        <Board />
      </Materials>
    </Canvas>
  )
}
