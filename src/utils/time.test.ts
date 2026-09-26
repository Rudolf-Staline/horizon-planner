import {
  describe,
  expect,
  it,
} from 'vitest'
import {
  nextSnapMinute,
} from './time'

describe(
  'nextSnapMinute',
  () => {
    it(
      'rounds forward instead of into the past',
      () => {
        expect(
          nextSnapMinute(
            12 * 60 + 7,
          ),
        ).toBe(
          12 * 60 + 15,
        )
      },
    )

    it(
      'keeps an exact slot unchanged',
      () => {
        expect(
          nextSnapMinute(
            14 * 60 + 30,
          ),
        ).toBe(
          14 * 60 + 30,
        )
      },
    )

    it(
      'respects planner day boundaries',
      () => {
        expect(
          nextSnapMinute(
            6 * 60,
          ),
        ).toBe(7 * 60)

        expect(
          nextSnapMinute(
            21 * 60 + 58,
          ),
        ).toBe(
          21 * 60 + 45,
        )
      },
    )
  },
)
