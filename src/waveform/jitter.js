// Per-case waveform variation so a diagnosis never looks pixel-identical twice
// (learners should read the ST segments, not memorize a picture).
//
// Deterministic: everything derives from (case seed, lead name), so the same
// dealt case always renders the same, and lead II in the grid stays identical
// to lead II in the rhythm strip.

// Whole-ECG amplitude scale (body habitus / lead placement), applied to every lead.
export const GLOBAL_AMP_RANGE = [0.85, 1.15]
// Extra per-lead amplitude scale on top of the global one.
export const LEAD_AMP_RANGE = [0.9, 1.1]
// Scale applied to a templated (diagnostic) ST deviation.
export const ST_SCALE_RANGE = [0.75, 1.25]
// A templated ST deviation never shrinks below this many mm (or its original
// value, if smaller) — jitter must never push a STEMI under the 1 mm criterion.
export const ST_FLOOR_MM = 1
// Max |ST| noise (mm) added to leads with no templated deviation. Kept well
// under 1 mm so a normal lead can never be jittered into "elevation".
export const ST_NOISE_MM = 0.3

// mulberry32: tiny, fast, seedable PRNG returning floats in [0, 1).
export function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// FNV-1a mix of a seed and a string key into a new 32-bit seed.
function mix(seed, key) {
  let h = (0x811C9DC5 ^ seed) >>> 0
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h
}

const between = (rng, [lo, hi]) => lo + rng() * (hi - lo)

// Random 32-bit seed for a newly dealt case. rng is injectable for tests.
export function rollSeed(rng = Math.random) {
  return Math.floor(rng() * 4294967296) >>> 0
}

export function jitterMorphology(morph, seed, lead) {
  const globalAmp = between(mulberry32(mix(seed, '*')), GLOBAL_AMP_RANGE)
  const rng = mulberry32(mix(seed, lead))
  const amp = globalAmp * between(rng, LEAD_AMP_RANGE)

  let st
  if (morph.st === 0) {
    st = (rng() * 2 - 1) * ST_NOISE_MM
  } else {
    const floor = Math.min(Math.abs(morph.st), ST_FLOOR_MM)
    const mag = Math.max(floor, Math.abs(morph.st) * between(rng, ST_SCALE_RANGE))
    st = Math.sign(morph.st) * mag
  }

  // Pure scaling keeps every wave's polarity (inverted T stays inverted).
  return {
    p: morph.p * amp,
    q: morph.q * amp,
    r: morph.r * amp,
    s: morph.s * amp,
    st,
    t: morph.t * amp,
  }
}
