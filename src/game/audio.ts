let ctx: AudioContext | null = null
let noise: AudioBuffer | null = null
let muted = false

export function isMuted() {
  return muted
}

export function setMuted(next: boolean) {
  muted = next
  if (muted && ctx) void ctx.suspend()
  if (!muted && ctx) void ctx.resume()
}

export function unlockAudio() {
  if (typeof window === "undefined") return
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return
  if (!ctx) {
    ctx = new AC()
    const len = ctx.sampleRate
    noise = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = noise.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  }
  if (!muted) void ctx.resume()
}

function envGain(duration: number, peak: number) {
  if (!ctx) return null
  const gain = ctx.createGain()
  const now = ctx.currentTime
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), now + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
  gain.connect(ctx.destination)
  return gain
}

function tone(freq: number, duration: number, type: OscillatorType, peak: number, slide = freq) {
  if (!ctx || muted) return
  const gain = envGain(duration, peak)
  if (!gain) return
  const osc = ctx.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(freq, ctx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, slide), ctx.currentTime + duration)
  osc.connect(gain)
  osc.start()
  osc.stop(ctx.currentTime + duration + 0.02)
}

function noiseBurst(duration: number, peak: number, freq: number) {
  if (!ctx || !noise || muted) return
  const gain = envGain(duration, peak)
  if (!gain) return
  const src = ctx.createBufferSource()
  src.buffer = noise
  const filter = ctx.createBiquadFilter()
  filter.type = "lowpass"
  filter.frequency.value = freq
  src.connect(filter)
  filter.connect(gain)
  src.start()
  src.stop(ctx.currentTime + duration)
}

export const sfx = {
  step() {
    noiseBurst(0.09, 0.08, 280)
    tone(90, 0.06, "sine", 0.03, 50)
  },
  swing() {
    noiseBurst(0.16, 0.07, 1400)
    tone(220, 0.12, "sawtooth", 0.015, 90)
  },
  crack() {
    noiseBurst(0.42, 0.22, 900)
    tone(140, 0.28, "triangle", 0.08, 42)
    tone(70, 0.4, "sine", 0.1, 36)
  },
  bell() {
    tone(520, 0.45, "sine", 0.04, 360)
    tone(780, 0.3, "sine", 0.02, 600)
  },
}
