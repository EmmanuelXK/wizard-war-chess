import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react"
import * as THREE from "three"
import { palette } from "./theme"

export type Mats = {
  light: THREE.MeshStandardMaterial
  lightTrim: THREE.MeshStandardMaterial
  dark: THREE.MeshStandardMaterial
  darkTrim: THREE.MeshStandardMaterial
  gold: THREE.MeshStandardMaterial
  steel: THREE.MeshStandardMaterial
  steelDark: THREE.MeshStandardMaterial
  ember: THREE.MeshStandardMaterial
  cold: THREE.MeshStandardMaterial
  mud: THREE.MeshStandardMaterial
  moss: THREE.MeshStandardMaterial
  tileLight: THREE.MeshStandardMaterial
  tileDark: THREE.MeshStandardMaterial
  slab: THREE.MeshStandardMaterial
  last: THREE.MeshBasicMaterial
  dot: THREE.MeshBasicMaterial
  ring: THREE.MeshBasicMaterial
  flame: THREE.MeshBasicMaterial
}

const Ctx = createContext<Mats | null>(null)

export function useMats() {
  const mats = useContext(Ctx)
  if (!mats) throw new Error("materials missing")
  return mats
}

function gritTexture(seed: number) {
  const size = 128
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const g = canvas.getContext("2d")
  if (!g) return null
  const img = g.createImageData(size, size)
  const d = img.data
  let n = seed
  const rand = () => {
    n = (n * 16807 + 13) % 2147483647
    return n / 2147483647
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const grain = 205 + Math.floor(rand() * 50)
      const pit = (x * 17 + y * 9 + seed) % 53 === 0 ? 40 : 0
      const v = Math.max(30, grain - pit)
      d[i] = d[i + 1] = d[i + 2] = v
      d[i + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  g.strokeStyle = "rgba(0,0,0,0.22)"
  g.lineWidth = 1
  for (let k = 0; k < 5; k++) {
    const y = rand() * size
    g.beginPath()
    g.moveTo(0, y)
    g.lineTo(size, y + (rand() - 0.5) * 10)
    g.stroke()
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

function stoneMat(color: string, roughness: number, metalness: number) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness })
}

function stoneFace(color: string, seed: number) {
  const mat = stoneMat(color, 0.96, 0.02)
  const grit = gritTexture(seed)
  if (grit) {
    mat.map = grit
    mat.bumpMap = grit
    mat.bumpScale = 0.035
  }
  return mat
}

export function Materials({ children }: { children: ReactNode }) {
  const mats = useMemo<Mats>(() => {
    const made: Mats = {
      light: stoneMat(palette.stoneLight, 0.58, 0.08),
      lightTrim: stoneMat(palette.stoneLightTrim, 0.66, 0.06),
      dark: stoneMat(palette.stoneDark, 0.52, 0.22),
      darkTrim: stoneMat(palette.stoneDarkTrim, 0.48, 0.28),
      gold: new THREE.MeshStandardMaterial({
        color: palette.gold,
        roughness: 0.36,
        metalness: 0.74,
        emissive: "#3a2408",
        emissiveIntensity: 0.18,
      }),
      steel: stoneMat(palette.steel, 0.28, 0.86),
      steelDark: stoneMat(palette.steelDark, 0.34, 0.8),
      ember: new THREE.MeshStandardMaterial({
        color: palette.ember,
        emissive: palette.torch,
        emissiveIntensity: 1.4,
        roughness: 0.4,
      }),
      cold: new THREE.MeshStandardMaterial({
        color: palette.cold,
        emissive: "#1f8f62",
        emissiveIntensity: 1.15,
        roughness: 0.35,
      }),
      mud: stoneMat(palette.mud, 0.96, 0.02),
      moss: stoneMat(palette.moss, 0.9, 0.02),
      tileLight: stoneFace(palette.marbleLight, 11),
      tileDark: stoneFace(palette.marbleDark, 29),
      slab: stoneFace("#6b645b", 47),
      last: new THREE.MeshBasicMaterial({
        color: palette.torch,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
      }),
      dot: new THREE.MeshBasicMaterial({ color: palette.torch }),
      ring: new THREE.MeshBasicMaterial({
        color: palette.ember,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
      flame: new THREE.MeshBasicMaterial({
        color: palette.torch,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    }
    made.tileLight.polygonOffset = true
    made.tileLight.polygonOffsetFactor = -1
    made.tileLight.polygonOffsetUnits = -1
    return made
  }, [])

  useEffect(() => {
    return () => {
      Object.values(mats).forEach((m) => {
        const map = m.map
        if ("bumpMap" in m && m.bumpMap && m.bumpMap !== map) m.bumpMap.dispose()
        map?.dispose()
        m.dispose()
      })
    }
  }, [mats])

  return <Ctx.Provider value={mats}>{children}</Ctx.Provider>
}
