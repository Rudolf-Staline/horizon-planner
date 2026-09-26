import { describe, expect, it } from 'vitest'
import { edgeScrollDelta } from './pointer'

describe('edgeScrollDelta', () => {
  it('does nothing in the safe center area', () => {
    expect(
      edgeScrollDelta(
        500,
        100,
        900,
      ),
    ).toBe(0)
  })

  it('scrolls upward near the top edge', () => {
    expect(
      edgeScrollDelta(
        110,
        100,
        900,
      ),
    ).toBeLessThan(0)
  })

  it('scrolls downward near the bottom edge', () => {
    expect(
      edgeScrollDelta(
        890,
        100,
        900,
      ),
    ).toBeGreaterThan(0)
  })

  it('increases magnitude closer to the edge', () => {
    const near =
      Math.abs(
        edgeScrollDelta(
          105,
          100,
          900,
        ),
      )
    const farther =
      Math.abs(
        edgeScrollDelta(
          150,
          100,
          900,
        ),
      )

    expect(near).toBeGreaterThan(
      farther,
    )
  })

  it('returns zero for invalid bounds', () => {
    expect(
      edgeScrollDelta(
        100,
        300,
        200,
      ),
    ).toBe(0)
  })
})
