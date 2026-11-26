import { describe, it, expect } from 'vitest'
import { jitterMorphology, mulberry32, rollSeed, ST_NOISE_MM, ST_FLOOR_MM } from '../../waveform/jitter'
import { leadMorphology, synthLead } from '../../waveform/synth'
import { LEADS, DIAGNOSIS_TEMPLATES } from '../../data/templates'

const SEEDS = Array.from({ length: 200 }, (_, i) => Math.imul(i, 2654435761) >>> 0)
const DIAGS = Object.keys(DIAGNOSIS_TEMPLATES)

describe('mulberry32 / rollSeed', () => {
  it('is deterministic and in [0,1)', () => {
    const a = mulberry32(42), b = mulberry32(42)
    for (let i = 0; i < 100; i++) {
      const v = a()
      expect(v).toBe(b())
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
  it('rollSeed yields a uint32', () => {
    expect(rollSeed(() => 0)).toBe(0)
    expect(rollSeed(() => 0.999999999)).toBeLessThanOrEqual(0xFFFFFFFF)
    expect(Number.isInteger(rollSeed())).toBe(true)
  })
})

describe('jitterMorphology', () => {
  it('is deterministic per (seed, lead)', () => {
    const m = leadMorphology('inferior', 'III')
    expect(jitterMorphology(m, 7, 'III')).toEqual(jitterMorphology(m, 7, 'III'))
  })
  it('varies across seeds', () => {
    const m = leadMorphology('inferior', 'III')
    const rs = new Set(SEEDS.slice(0, 20).map(s => jitterMorphology(m, s, 'III').r))
    expect(rs.size).toBeGreaterThan(15)
  })
  it('preserves polarity of every wave and of templated ST', () => {
    for (const d of DIAGS) for (const lead of LEADS) {
      const m = leadMorphology(d, lead)
      for (const s of SEEDS) {
        const j = jitterMorphology(m, s, lead)
        for (const k of ['p', 'q', 'r', 's', 't']) expect(Math.sign(j[k])).toBe(Math.sign(m[k]))
        if (m.st !== 0) expect(Math.sign(j.st)).toBe(Math.sign(m.st))
      }
    }
  })
  it('never pushes a templated ST deviation below the 1 mm criterion', () => {
    for (const d of DIAGS) for (const lead of LEADS) {
      const m = leadMorphology(d, lead)
      if (m.st === 0) continue
      const floor = Math.min(Math.abs(m.st), ST_FLOOR_MM)
      for (const s of SEEDS) expect(Math.abs(jitterMorphology(m, s, lead).st)).toBeGreaterThanOrEqual(floor)
    }
  })
  it('keeps non-templated leads well under diagnostic ST deviation', () => {
    for (const lead of LEADS) {
      const m = leadMorphology('no-stemi', lead)
      for (const s of SEEDS) expect(Math.abs(jitterMorphology(m, s, lead).st)).toBeLessThanOrEqual(ST_NOISE_MM)
    }
  })
})

describe('synthLead with seed', () => {
  const opts = { baselineY: 110, minWidthPx: 600 }
  it('renders the exact template when no seed is given', () => {
    const a = synthLead({ diagnosis: 'anterior', bpm: 80 }, 'V2', opts)
    const b = synthLead({ diagnosis: 'anterior', bpm: 80, seed: undefined }, 'V2', opts)
    expect(a.d).toBe(b.d)
  })
  it('same seed gives identical path (grid lead II matches the rhythm strip)', () => {
    const c = { diagnosis: 'anterior', bpm: 80, seed: 123 }
    expect(synthLead(c, 'II', opts).d).toBe(synthLead({ ...c }, 'II', opts).d)
  })
  it('different seeds give different paths', () => {
    const c = { diagnosis: 'anterior', bpm: 80 }
    expect(synthLead({ ...c, seed: 1 }, 'V2', opts).d).not.toBe(synthLead({ ...c, seed: 2 }, 'V2', opts).d)
  })
})
