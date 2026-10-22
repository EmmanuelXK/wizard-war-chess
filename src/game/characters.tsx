import { useRef, type ReactNode, type RefObject } from "react"
import { useFrame } from "@react-three/fiber"
import type { Group, MeshStandardMaterial } from "three"
import type { Color } from "chess.js"
import type { Actor } from "./actors"
import { useMats, type Mats } from "./materials"

type Tone = {
  mats: Mats
  body: MeshStandardMaterial
  trim: MeshStandardMaterial
  metal: MeshStandardMaterial
}

function useTone(color: Color): Tone {
  const mats = useMats()
  const pale = color === "w"
  return {
    mats,
    body: pale ? mats.light : mats.dark,
    trim: pale ? mats.lightTrim : mats.darkTrim,
    metal: pale ? mats.steel : mats.steelDark,
  }
}

function useHumanRig(actor: Actor) {
  const hip = useRef<Group>(null)
  const legL = useRef<Group>(null)
  const legR = useRef<Group>(null)
  const armL = useRef<Group>(null)
  const armR = useRef<Group>(null)
  const head = useRef<Group>(null)
  const crown = useRef<Group>(null)

  useFrame(() => {
    const pose = actor.pose
    if (hip.current) {
      hip.current.position.z = pose.lunge * 0.5
      hip.current.rotation.x = pose.lean
    }
    if (legL.current) legL.current.rotation.x = pose.legL
    if (legR.current) legR.current.rotation.x = pose.legR
    if (armL.current) armL.current.rotation.x = pose.armL
    if (armR.current) {
      armR.current.rotation.x = pose.armR
      armR.current.rotation.z = pose.twist * 0.65
    }
    if (head.current) head.current.rotation.x = pose.neck
    if (crown.current) {
      crown.current.position.y = pose.yield * 0.36
      crown.current.position.x = pose.yield * 0.2
      crown.current.rotation.z = pose.yield * 1.7
    }
  })

  return { hip, legL, legR, armL, armR, head, crown }
}

function Leg({
  pivot,
  x,
  y = 0.46,
  body,
  boot,
  bulk = 1,
}: {
  pivot: RefObject<Group | null>
  x: number
  y?: number
  body: MeshStandardMaterial
  boot: MeshStandardMaterial
  bulk?: number
}) {
  return (
    <group ref={pivot} position={[x, y, 0]}>
      <mesh position={[0, -0.1, 0]} material={body} dispose={null}>
        <cylinderGeometry args={[0.055 * bulk, 0.042 * bulk, 0.18, 6]} />
      </mesh>
      <mesh position={[0, -0.22, 0.015]} material={boot} dispose={null}>
        <cylinderGeometry args={[0.048 * bulk, 0.036 * bulk, 0.14, 6]} />
      </mesh>
      <mesh position={[0, -0.31, 0.05]} material={boot} dispose={null}>
        <boxGeometry args={[0.1 * bulk, 0.065, 0.18]} />
      </mesh>
    </group>
  )
}

function Arm({
  pivot,
  x,
  y,
  body,
  bulk = 1,
  children,
}: {
  pivot: RefObject<Group | null>
  x: number
  y: number
  body: MeshStandardMaterial
  bulk?: number
  children?: ReactNode
}) {
  return (
    <group ref={pivot} position={[x, y, 0]}>
      <mesh position={[0, -0.12, 0]} material={body} dispose={null}>
        <cylinderGeometry args={[0.04 * bulk, 0.032 * bulk, 0.18, 6]} />
      </mesh>
      <mesh position={[0, -0.24, 0.02]} material={body} dispose={null}>
        <sphereGeometry args={[0.04 * bulk, 7, 6]} />
      </mesh>
      {children}
    </group>
  )
}

function Eyes({
  y = 0,
  z = 0.09,
  gap = 0.038,
  s = 0.02,
  mat,
}: {
  y?: number
  z?: number
  gap?: number
  s?: number
  mat?: MeshStandardMaterial
}) {
  const mats = useMats()
  const eye = mat ?? mats.ember
  return (
    <>
      <mesh position={[-gap, y, z]} material={eye} dispose={null}>
        <sphereGeometry args={[s, 6, 6]} />
      </mesh>
      <mesh position={[gap, y, z]} material={eye} dispose={null}>
        <sphereGeometry args={[s, 6, 6]} />
      </mesh>
    </>
  )
}

const CURLS: [number, number, number, number][] = [
  [0, 0.17, -0.02, 0.1],
  [-0.11, 0.13, 0.0, 0.082],
  [0.11, 0.12, 0.0, 0.086],
  [-0.14, 0.04, -0.02, 0.068],
  [0.14, 0.04, -0.02, 0.07],
  [-0.06, 0.16, -0.08, 0.078],
  [0.06, 0.17, -0.07, 0.072],
  [0, 0.21, 0.0, 0.068],
]

export function Pawn({ actor }: { actor: Actor }) {
  const rig = useHumanRig(actor)
  const mats = useMats()
  const pale = actor.color === "w"
  const skin = pale ? mats.skin : mats.skinDark
  const hair = pale ? mats.hair : mats.hairDark
  const cape = pale ? mats.cape : mats.capeDark
  const tunic = pale ? mats.tunic : mats.vest
  const pants = pale ? mats.pants : mats.pantsDark
  const sleeve = pale ? mats.sleeve : mats.sleeveDark
  const leather = pale ? mats.leather : mats.leatherDark
  const wood = pale ? mats.wood : mats.woodDark
  const scarf = pale ? mats.cape : mats.scarf
  return (
    <group ref={rig.hip}>
      <Leg pivot={rig.legL} x={-0.09} y={0.42} body={pants} boot={leather} bulk={1.05} />
      <Leg pivot={rig.legR} x={0.09} y={0.42} body={pants} boot={leather} bulk={1.05} />
      <mesh position={[0, 0.48, 0]} material={tunic} castShadow dispose={null}>
        <cylinderGeometry args={[0.13, 0.17, 0.16, 8]} />
      </mesh>
      <mesh position={[0, 0.68, 0.03]} material={tunic} castShadow dispose={null}>
        <boxGeometry args={[0.26, 0.28, 0.18]} />
      </mesh>
      {[0.78, 0.69, 0.6].map((y) => (
        <mesh key={y} position={[0.02, y, 0.13]} material={mats.gold} dispose={null}>
          <sphereGeometry args={[0.02, 6, 6]} />
        </mesh>
      ))}
      <mesh position={[0, 0.545, 0.02]} material={leather} dispose={null}>
        <boxGeometry args={[0.3, 0.045, 0.18]} />
      </mesh>
      <mesh position={[0, 0.545, 0.115]} material={mats.gold} dispose={null}>
        <boxGeometry args={[0.07, 0.05, 0.02]} />
      </mesh>
      <mesh position={[0.13, 0.5, 0.07]} material={leather} castShadow dispose={null}>
        <boxGeometry args={[0.07, 0.08, 0.05]} />
      </mesh>
      <mesh position={[0, 0.8, 0]} rotation={[Math.PI / 2, 0, 0]} material={scarf} dispose={null}>
        <torusGeometry args={[0.1, 0.032, 6, 12]} />
      </mesh>
      <group position={[0, 0.7, -0.1]}>
        <mesh position={[0, -0.3, -0.04]} rotation={[0.45, 0, 0]} material={cape} castShadow dispose={null}>
          <boxGeometry args={[0.3, 0.52, 0.022]} />
        </mesh>
        <mesh position={[0, -0.28, -0.02]} rotation={[0.45, 0, 0]} material={mats.lining} dispose={null}>
          <boxGeometry args={[0.22, 0.4, 0.01]} />
        </mesh>
        <mesh position={[-0.14, -0.26, 0.0]} rotation={[0.4, 0.05, 0.28]} material={cape} castShadow dispose={null}>
          <boxGeometry args={[0.1, 0.46, 0.018]} />
        </mesh>
        <mesh position={[0.14, -0.26, 0.0]} rotation={[0.4, -0.05, -0.28]} material={cape} castShadow dispose={null}>
          <boxGeometry args={[0.1, 0.46, 0.018]} />
        </mesh>
        {!pale && (
          <mesh position={[0, -0.54, -0.08]} rotation={[0.45, 0, 0]} material={mats.gold} dispose={null}>
            <boxGeometry args={[0.3, 0.02, 0.016]} />
          </mesh>
        )}
      </group>
      <mesh position={[0.08, 0.78, 0.1]} rotation={[0.3, 0.2, 0.7]} scale={[0.55, 1.15, 0.22]} material={mats.gold} dispose={null}>
        <sphereGeometry args={[0.045, 6, 5]} />
      </mesh>
      <group ref={rig.head} position={[0, 0.98, 0.02]}>
        <mesh material={skin} castShadow dispose={null}>
          <sphereGeometry args={[0.16, 14, 12]} />
        </mesh>
        <mesh position={[0, -0.02, 0.15]} material={skin} dispose={null}>
          <sphereGeometry args={[0.028, 6, 5]} />
        </mesh>
        <mesh position={[-0.175, 0.03, 0.02]} rotation={[0.2, 0, Math.PI / 2.4]} material={skin} castShadow dispose={null}>
          <coneGeometry args={[0.038, 0.12, 5]} />
        </mesh>
        <mesh position={[0.175, 0.03, 0.02]} rotation={[0.2, 0, -Math.PI / 2.4]} material={skin} castShadow dispose={null}>
          <coneGeometry args={[0.038, 0.12, 5]} />
        </mesh>
        {CURLS.map(([x, y, z, r], i) => (
          <mesh key={i} position={[x, y, z]} material={hair} castShadow dispose={null}>
            <sphereGeometry args={[r, 8, 6]} />
          </mesh>
        ))}
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 0.06, 0.04, 0.13]}>
            <mesh material={mats.eyeWhite} dispose={null}>
              <sphereGeometry args={[0.046, 8, 6]} />
            </mesh>
            <mesh position={[0, -0.004, 0.028]} material={mats.iris} dispose={null}>
              <sphereGeometry args={[0.024, 7, 6]} />
            </mesh>
            <mesh position={[0, -0.004, 0.044]} material={mats.pupil} dispose={null}>
              <sphereGeometry args={[0.012, 6, 5]} />
            </mesh>
          </group>
        ))}
        <mesh position={[-0.058, 0.09, 0.13]} rotation={[0.2, 0, 0.35]} material={hair} dispose={null}>
          <boxGeometry args={[0.055, 0.014, 0.016]} />
        </mesh>
        <mesh position={[0.058, 0.09, 0.13]} rotation={[0.2, 0, -0.35]} material={hair} dispose={null}>
          <boxGeometry args={[0.055, 0.014, 0.016]} />
        </mesh>
      </group>
      <group ref={rig.armL} position={[-0.18, 0.74, 0]}>
        <mesh position={[0, -0.1, 0]} material={sleeve} castShadow dispose={null}>
          <cylinderGeometry args={[0.046, 0.036, 0.16, 7]} />
        </mesh>
        <mesh position={[0, -0.2, 0.02]} material={skin} dispose={null}>
          <sphereGeometry args={[0.042, 8, 6]} />
        </mesh>
        <group position={[-0.03, -0.2, 0.06]} rotation={[0.06, 0, 0.22]}>
          <mesh position={[0, 0.34, 0]} material={wood} castShadow dispose={null}>
            <cylinderGeometry args={[0.024, 0.032, 1.28, 7]} />
          </mesh>
          <mesh position={[0, 1.02, 0]} material={wood} castShadow dispose={null}>
            <octahedronGeometry args={[0.055, 0]} />
          </mesh>
          <mesh position={[0, 0.55, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.gold} dispose={null}>
            <torusGeometry args={[0.034, 0.008, 5, 10]} />
          </mesh>
          <mesh position={[0, 0.12, 0]} rotation={[Math.PI / 2, 0, 0]} material={leather} dispose={null}>
            <torusGeometry args={[0.03, 0.007, 4, 8]} />
          </mesh>
        </group>
      </group>
      <group ref={rig.armR} position={[0.18, 0.74, 0]}>
        <mesh position={[0, -0.1, 0]} material={sleeve} castShadow dispose={null}>
          <cylinderGeometry args={[0.044, 0.034, 0.16, 7]} />
        </mesh>
        <mesh position={[0, -0.2, 0.03]} material={skin} dispose={null}>
          <sphereGeometry args={[0.04, 8, 6]} />
        </mesh>
      </group>
    </group>
  )
}

export function Rook({ actor }: { actor: Actor }) {
  const rig = useHumanRig(actor)
  const { body, trim, metal, mats } = useTone(actor.color)
  return (
    <group ref={rig.hip}>
      <Leg pivot={rig.legL} x={-0.14} y={0.5} body={body} boot={trim} bulk={1.35} />
      <Leg pivot={rig.legR} x={0.14} y={0.5} body={body} boot={trim} bulk={1.35} />
      <mesh position={[0, 0.62, 0]} material={body} castShadow dispose={null}>
        <boxGeometry args={[0.42, 0.28, 0.26]} />
      </mesh>
      <mesh position={[0, 0.84, 0]} material={body} castShadow dispose={null}>
        <boxGeometry args={[0.5, 0.28, 0.28]} />
      </mesh>
      <mesh position={[-0.3, 0.96, 0]} material={trim} castShadow dispose={null}>
        <boxGeometry args={[0.16, 0.1, 0.22]} />
      </mesh>
      <mesh position={[0.3, 0.96, 0]} material={trim} castShadow dispose={null}>
        <boxGeometry args={[0.16, 0.1, 0.22]} />
      </mesh>
      <mesh position={[0, 0.78, 0.15]} material={mats.gold} dispose={null}>
        <boxGeometry args={[0.1, 0.1, 0.03]} />
      </mesh>
      <group ref={rig.head} position={[0, 1.12, 0]}>
        <mesh material={trim} castShadow dispose={null}>
          <boxGeometry args={[0.26, 0.22, 0.24]} />
        </mesh>
        <mesh position={[-0.08, 0.16, 0]} material={body} dispose={null}>
          <boxGeometry args={[0.06, 0.1, 0.22]} />
        </mesh>
        <mesh position={[0, 0.18, 0]} material={body} dispose={null}>
          <boxGeometry args={[0.06, 0.12, 0.22]} />
        </mesh>
        <mesh position={[0.08, 0.16, 0]} material={body} dispose={null}>
          <boxGeometry args={[0.06, 0.1, 0.22]} />
        </mesh>
        <Eyes y={0.01} z={0.13} gap={0.06} s={0.018} />
      </group>
      <Arm pivot={rig.armL} x={-0.34} y={0.9} body={body} bulk={1.25}>
        <mesh position={[0.06, -0.18, 0.16]} material={metal} dispose={null}>
          <boxGeometry args={[0.05, 0.05, 0.16]} />
        </mesh>
      </Arm>
      <Arm pivot={rig.armR} x={0.32} y={0.92} body={body} bulk={1.3}>
        <mesh position={[-0.04, -0.12, 0.22]} rotation={[1.15, 0, 0]} material={trim} dispose={null}>
          <cylinderGeometry args={[0.03, 0.03, 0.28, 6]} />
        </mesh>
        <mesh position={[-0.02, -0.02, 0.36]} material={metal} castShadow dispose={null}>
          <sphereGeometry args={[0.09, 10, 8]} />
        </mesh>
        <mesh position={[-0.02, 0.08, 0.36]} material={mats.gold} dispose={null}>
          <coneGeometry args={[0.03, 0.08, 5]} />
        </mesh>
      </Arm>
    </group>
  )
}

export function Bishop({ actor }: { actor: Actor }) {
  const rig = useHumanRig(actor)
  const { body, trim, metal, mats } = useTone(actor.color)
  return (
    <group ref={rig.hip}>
      <Leg pivot={rig.legL} x={-0.08} body={body} boot={trim} bulk={0.85} />
      <Leg pivot={rig.legR} x={0.08} body={body} boot={trim} bulk={0.85} />
      <mesh position={[0, 0.62, 0]} material={body} castShadow dispose={null}>
        <cylinderGeometry args={[0.16, 0.28, 0.62, 8]} />
      </mesh>
      <mesh position={[0, 0.72, 0.12]} material={mats.gold} dispose={null}>
        <boxGeometry args={[0.04, 0.42, 0.02]} />
      </mesh>
      <mesh position={[0, 0.9, 0]} material={trim} dispose={null}>
        <cylinderGeometry args={[0.11, 0.16, 0.16, 8]} />
      </mesh>
      <group ref={rig.head} position={[0, 1.12, 0]}>
        <mesh material={body} castShadow dispose={null}>
          <sphereGeometry args={[0.09, 10, 8]} />
        </mesh>
        <mesh position={[0, 0.2, 0]} material={trim} castShadow dispose={null}>
          <coneGeometry args={[0.11, 0.4, 6]} />
        </mesh>
        <mesh position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.gold} dispose={null}>
          <torusGeometry args={[0.09, 0.014, 5, 10]} />
        </mesh>
        <Eyes y={-0.01} z={0.085} s={0.016} />
      </group>
      <Arm pivot={rig.armL} x={-0.18} y={0.92} body={body} bulk={0.85} />
      <Arm pivot={rig.armR} x={0.18} y={0.96} body={body} bulk={0.9}>
        <mesh position={[0, 0.22, 0.04]} material={metal} dispose={null}>
          <cylinderGeometry args={[0.02, 0.025, 1.05, 6]} />
        </mesh>
        <mesh position={[0, 0.78, 0.04]} rotation={[Math.PI / 2, 0, 0]} material={mats.gold} dispose={null}>
          <torusGeometry args={[0.07, 0.016, 5, 10]} />
        </mesh>
      </Arm>
    </group>
  )
}

export function Queen({ actor }: { actor: Actor }) {
  const rig = useHumanRig(actor)
  const { body, trim, metal, mats } = useTone(actor.color)
  return (
    <group ref={rig.hip}>
      <Leg pivot={rig.legL} x={-0.08} body={body} boot={trim} bulk={0.8} />
      <Leg pivot={rig.legR} x={0.08} body={body} boot={trim} bulk={0.8} />
      <mesh position={[0, 0.58, 0]} material={trim} dispose={null}>
        <cylinderGeometry args={[0.2, 0.12, 0.46, 8]} />
      </mesh>
      <mesh position={[0, 0.84, 0]} material={body} castShadow dispose={null}>
        <cylinderGeometry args={[0.1, 0.14, 0.28, 8]} />
      </mesh>
      <mesh position={[-0.1, 0.7, -0.08]} rotation={[0.15, 0, 0.35]} material={trim} dispose={null}>
        <boxGeometry args={[0.04, 0.55, 0.02]} />
      </mesh>
      <mesh position={[0.1, 0.7, -0.08]} rotation={[0.15, 0, -0.35]} material={trim} dispose={null}>
        <boxGeometry args={[0.04, 0.55, 0.02]} />
      </mesh>
      <mesh position={[0, 0.9, 0.08]} material={mats.gold} dispose={null}>
        <boxGeometry args={[0.12, 0.03, 0.02]} />
      </mesh>
      <group ref={rig.head} position={[0, 1.14, 0]}>
        <mesh material={body} castShadow dispose={null}>
          <sphereGeometry args={[0.09, 10, 8]} />
        </mesh>
        <mesh position={[0, -0.04, 0.06]} material={trim} dispose={null}>
          <boxGeometry args={[0.06, 0.08, 0.04]} />
        </mesh>
        <Eyes y={0.01} z={0.085} />
        <group ref={rig.crown} position={[0, 0.1, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={mats.gold} dispose={null}>
            <torusGeometry args={[0.09, 0.016, 5, 12]} />
          </mesh>
          {[0, 1, 2, 3, 4].map((i) => (
            <mesh
              key={i}
              position={[Math.sin((i / 5) * Math.PI * 2) * 0.08, 0.06, Math.cos((i / 5) * Math.PI * 2) * 0.08]}
              material={mats.gold}
              dispose={null}
            >
              <coneGeometry args={[0.02, 0.09, 5]} />
            </mesh>
          ))}
        </group>
      </group>
      <Arm pivot={rig.armL} x={-0.16} y={0.96} body={body} bulk={0.8} />
      <Arm pivot={rig.armR} x={0.16} y={0.96} body={body} bulk={0.85}>
        <mesh position={[0, -0.42, 0.08]} rotation={[0.25, 0, 0]} material={metal} dispose={null}>
          <boxGeometry args={[0.025, 0.62, 0.012]} />
        </mesh>
        <mesh position={[0, -0.16, 0.05]} material={mats.gold} dispose={null}>
          <boxGeometry args={[0.14, 0.025, 0.03]} />
        </mesh>
      </Arm>
    </group>
  )
}

export function King({ actor }: { actor: Actor }) {
  const rig = useHumanRig(actor)
  const { body, trim, metal, mats } = useTone(actor.color)
  return (
    <group ref={rig.hip}>
      <Leg pivot={rig.legL} x={-0.11} body={body} boot={trim} bulk={1.05} />
      <Leg pivot={rig.legR} x={0.11} body={body} boot={trim} bulk={1.05} />
      <mesh position={[0, 0.42, -0.08]} rotation={[0.2, 0, 0]} material={trim} dispose={null}>
        <boxGeometry args={[0.36, 0.55, 0.04]} />
      </mesh>
      <mesh position={[0, 0.64, 0]} material={body} castShadow dispose={null}>
        <cylinderGeometry args={[0.16, 0.2, 0.32, 8]} />
      </mesh>
      <mesh position={[0, 0.86, 0]} material={body} castShadow dispose={null}>
        <boxGeometry args={[0.36, 0.24, 0.2]} />
      </mesh>
      <mesh position={[0, 0.86, 0.11]} material={mats.gold} dispose={null}>
        <boxGeometry args={[0.1, 0.12, 0.02]} />
      </mesh>
      <mesh position={[0, 0.86, 0.12]} material={mats.gold} dispose={null}>
        <boxGeometry args={[0.04, 0.16, 0.02]} />
      </mesh>
      <group ref={rig.head} position={[0, 1.14, 0]}>
        <mesh material={body} castShadow dispose={null}>
          <sphereGeometry args={[0.11, 10, 8]} />
        </mesh>
        <mesh position={[0, -0.06, 0.08]} material={trim} dispose={null}>
          <boxGeometry args={[0.08, 0.1, 0.05]} />
        </mesh>
        <Eyes y={0.01} z={0.1} gap={0.04} />
        <group ref={rig.crown} position={[0, 0.12, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={mats.gold} dispose={null}>
            <cylinderGeometry args={[0.1, 0.1, 0.04, 8]} />
          </mesh>
          <mesh position={[0, 0.12, 0]} material={mats.gold} dispose={null}>
            <boxGeometry args={[0.025, 0.2, 0.025]} />
          </mesh>
          <mesh position={[0, 0.16, 0]} material={mats.gold} dispose={null}>
            <boxGeometry args={[0.14, 0.025, 0.025]} />
          </mesh>
        </group>
      </group>
      <Arm pivot={rig.armL} x={-0.24} y={0.94} body={body} />
      <Arm pivot={rig.armR} x={0.24} y={0.94} body={body} bulk={1.05}>
        <mesh position={[0, -0.36, 0.1]} rotation={[0.2, 0, 0]} material={metal} dispose={null}>
          <boxGeometry args={[0.05, 0.58, 0.02]} />
        </mesh>
        <mesh position={[0, -0.12, 0.06]} material={mats.gold} dispose={null}>
          <boxGeometry args={[0.18, 0.03, 0.035]} />
        </mesh>
      </Arm>
    </group>
  )
}

export function Knight({ actor }: { actor: Actor }) {
  const { body, trim, metal, mats } = useTone(actor.color)
  const hip = useRef<Group>(null)
  const neck = useRef<Group>(null)
  const armR = useRef<Group>(null)
  const rein = useRef<Group>(null)
  const legFL = useRef<Group>(null)
  const legFR = useRef<Group>(null)
  const legBL = useRef<Group>(null)
  const legBR = useRef<Group>(null)

  useFrame(() => {
    const pose = actor.pose
    if (hip.current) {
      hip.current.position.z = pose.lunge * 0.36
      hip.current.rotation.x = pose.lean
    }
    if (neck.current) neck.current.rotation.x = pose.neck
    if (armR.current) armR.current.rotation.x = pose.armR
    if (rein.current) rein.current.rotation.x = Math.sin(actor.cycle * 0.5) * 0.18
    const pivots = [legFL.current, legFR.current, legBL.current, legBR.current]
    const angles = [pose.legFL, pose.legFR, pose.legBL, pose.legBR]
    pivots.forEach((leg, i) => {
      if (leg) leg.rotation.x = angles[i] ?? 0
    })
  })

  const spots: [RefObject<Group | null>, number, number, number][] = [
    [legFL, -0.1, 0.52, 0.24],
    [legFR, 0.1, 0.52, 0.24],
    [legBL, -0.11, 0.5, -0.24],
    [legBR, 0.11, 0.5, -0.24],
  ]

  return (
    <group ref={hip}>
      <mesh position={[0, 0.64, 0.02]} scale={[0.18, 0.15, 0.36]} material={body} castShadow dispose={null}>
        <sphereGeometry args={[1, 12, 10]} />
      </mesh>
      <mesh position={[0, 0.68, 0.28]} scale={[0.15, 0.13, 0.16]} material={body} dispose={null}>
        <sphereGeometry args={[1, 10, 8]} />
      </mesh>
      <mesh position={[0, 0.66, -0.28]} scale={[0.14, 0.12, 0.16]} material={body} dispose={null}>
        <sphereGeometry args={[1, 10, 8]} />
      </mesh>
      <mesh position={[0, 0.7, -0.46]} rotation={[0.8, 0, 0]} material={trim} dispose={null}>
        <coneGeometry args={[0.04, 0.22, 5]} />
      </mesh>
      {spots.map(([pivot, x, y, z]) => (
        <group key={`${x}-${z}`} ref={pivot} position={[x, y, z]}>
          <mesh position={[0, -0.12, 0]} material={body} dispose={null}>
            <cylinderGeometry args={[0.045, 0.035, 0.18, 6]} />
          </mesh>
          <mesh position={[0, -0.24, 0.02]} material={trim} dispose={null}>
            <boxGeometry args={[0.06, 0.07, 0.1]} />
          </mesh>
        </group>
      ))}
      <group ref={neck} position={[0, 0.78, 0.34]}>
        <mesh position={[0, 0.1, 0.08]} rotation={[0.75, 0, 0]} material={body} castShadow dispose={null}>
          <cylinderGeometry args={[0.055, 0.09, 0.3, 7]} />
        </mesh>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} position={[0, 0.16 - i * 0.04, 0.02 - i * 0.02]} material={trim} dispose={null}>
            <coneGeometry args={[0.025, 0.08, 4]} />
          </mesh>
        ))}
        <mesh position={[0, 0.24, 0.24]} material={body} castShadow dispose={null}>
          <boxGeometry args={[0.1, 0.1, 0.2]} />
        </mesh>
        <mesh position={[0, 0.22, 0.36]} material={trim} dispose={null}>
          <boxGeometry args={[0.07, 0.07, 0.12]} />
        </mesh>
        <mesh position={[-0.035, 0.32, 0.2]} material={trim} dispose={null}>
          <coneGeometry args={[0.02, 0.08, 4]} />
        </mesh>
        <mesh position={[0.035, 0.32, 0.2]} material={trim} dispose={null}>
          <coneGeometry args={[0.02, 0.08, 4]} />
        </mesh>
        <Eyes y={0.26} z={0.32} gap={0.03} s={0.015} />
      </group>
      <mesh position={[0, 0.78, -0.02]} material={trim} dispose={null}>
        <boxGeometry args={[0.16, 0.06, 0.2]} />
      </mesh>
      <mesh position={[0, 0.96, -0.04]} material={body} castShadow dispose={null}>
        <boxGeometry args={[0.16, 0.18, 0.12]} />
      </mesh>
      <mesh position={[0, 1.12, -0.03]} material={trim} dispose={null}>
        <sphereGeometry args={[0.08, 8, 7]} />
      </mesh>
      <mesh position={[0, 1.16, -0.03]} scale={[1, 0.45, 1]} material={metal} dispose={null}>
        <sphereGeometry args={[0.09, 8, 7]} />
      </mesh>
      <Eyes y={1.12} z={0.05} gap={0.028} s={0.014} />
      <group ref={rein} position={[-0.12, 1.02, 0]}>
        <mesh position={[0, -0.12, 0.08]} material={body} dispose={null}>
          <cylinderGeometry args={[0.025, 0.02, 0.16, 5]} />
        </mesh>
      </group>
      <group ref={armR} position={[0.12, 1.02, 0.02]}>
        <mesh position={[0, -0.08, 0.08]} material={body} dispose={null}>
          <cylinderGeometry args={[0.028, 0.022, 0.14, 5]} />
        </mesh>
        <mesh position={[0.02, -0.08, 0.48]} rotation={[Math.PI / 2, 0, 0]} material={metal} dispose={null}>
          <cylinderGeometry args={[0.018, 0.018, 0.78, 6]} />
        </mesh>
        <mesh position={[0.02, -0.08, 0.9]} rotation={[Math.PI / 2, 0, 0]} material={mats.gold} dispose={null}>
          <coneGeometry args={[0.045, 0.14, 6]} />
        </mesh>
      </group>
    </group>
  )
}
