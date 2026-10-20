// Deterministic pseudo-random helpers so every reset produces the same dataset.

export function createRng(seed: number) {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    float: (min: number, max: number, digits = 2) => Number((next() * (max - min) + min).toFixed(digits)),
    pick: <T>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)],
    pickN: <T>(arr: readonly T[], n: number): T[] => {
      const copy = [...arr]
      const out: T[] = []
      while (out.length < n && copy.length) out.push(copy.splice(Math.floor(next() * copy.length), 1)[0])
      return out
    },
    chance: (p: number) => next() < p,
    weighted: <T>(items: readonly [T, number][]): T => {
      const total = items.reduce((s, [, w]) => s + w, 0)
      let r = next() * total
      for (const [item, w] of items) {
        if ((r -= w) <= 0) return item
      }
      return items[items.length - 1][0]
    },
  }
}

export type Rng = ReturnType<typeof createRng>

/** Builds date helpers anchored to the moment the seed is generated. */
export function createClock(anchor: Date) {
  const base = new Date(anchor)
  base.setMinutes(0, 0, 0)
  return {
    anchor: base,
    ago: (days: number, hours = 0, minutes = 0) => new Date(base.getTime() - ((days * 24 + hours) * 60 + minutes) * 60_000).toISOString(),
    ahead: (days: number, hours = 0) => new Date(base.getTime() + (days * 24 + hours) * 3_600_000).toISOString(),
  }
}

export type Clock = ReturnType<typeof createClock>

export const pad = (n: number, width = 4) => String(n).padStart(width, '0')
