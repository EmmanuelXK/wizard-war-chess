import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import type { Group, Mesh } from "three"
import * as THREE from "three"
import { FLOOR, type Actor } from "./actors"
import { palette } from "./theme"
import { useGame } from "./store"
import { Bishop, King, Knight, Pawn, Queen, Rook } from "./characters"

export function ActorView({ actor }: { actor: Actor }) {
  const root = useRef<Group>(null)
  const body = useRef<Group>(null)
  const shardRefs = useRef<(Mesh | null)[]>([])
  const flashRef = useRef<Mesh>(null)
  const flashMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: palette.flash,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    [],
  )
  const toneMat = actor.color === "w" ? palette.stoneLight : palette.stoneDark
  const shardMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: toneMat, roughness: 0.6, metalness: 0.12 }),
    [toneMat],
  )

  useFrame(() => {
    if (!root.current) return
    const show = actor.pose.dead < 0.5 && !actor.gone
    if (body.current) body.current.visible = show
    root.current.visible = show
    root.current.position.set(actor.pos.x, FLOOR + actor.pos.y + actor.pose.bob, actor.pos.z)
    root.current.rotation.set(0, actor.yaw, 0)
    actor.shards.forEach((shard, i) => {
      const mesh = shardRefs.current[i]
      if (!mesh) return
      mesh.visible = shard.on
      mesh.position.set(shard.x, shard.y, shard.z)
      mesh.rotation.set(shard.rx, shard.ry, shard.rz)
      mesh.scale.setScalar(shard.s)
    })
    if (flashRef.current) {
      flashRef.current.visible = actor.flash > 0.02
      flashRef.current.position.set(actor.pos.x, FLOOR + 0.4, actor.pos.z)
      flashRef.current.scale.setScalar(0.4 + (1 - actor.flash) * 1.35)
      flashMat.opacity = actor.flash * 0.9
    }
  })

  const scale = actor.type === "p" ? 1 : actor.type === "n" ? 0.9 : actor.type === "b" ? 0.96 : actor.type === "k" ? 1.02 : 0.98
  const bodyMesh =
    actor.type === "n" ? (
      <Knight actor={actor} />
    ) : actor.type === "r" ? (
      <Rook actor={actor} />
    ) : actor.type === "b" ? (
      <Bishop actor={actor} />
    ) : actor.type === "q" ? (
      <Queen actor={actor} />
    ) : actor.type === "k" ? (
      <King actor={actor} />
    ) : (
      <Pawn actor={actor} />
    )

  return (
    <>
      <group ref={root} onClick={(e) => { e.stopPropagation(); if (actor.square) useGame.getState().pick(actor.square) }}
        onPointerOver={(e) => {
          e.stopPropagation()
          document.body.style.cursor = "pointer"
        }}
        onPointerOut={() => {
          document.body.style.cursor = "grab"
        }}
      >
        <group ref={body} scale={scale}>
          {bodyMesh}
        </group>
      </group>
      {actor.shards.map((_, i) => (
        <mesh
          key={i}
          ref={(node) => {
            shardRefs.current[i] = node
          }}
          visible={false}
          material={shardMat}
          dispose={null}
          raycast={() => null}
        >
          <boxGeometry />
        </mesh>
      ))}
      <mesh ref={flashRef} visible={false} material={flashMat} dispose={null} raycast={() => null}>
        <sphereGeometry args={[0.45, 12, 10]} />
      </mesh>
    </>
  )
}
