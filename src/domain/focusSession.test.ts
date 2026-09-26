import {
  describe,
  expect,
  it,
} from 'vitest'
import {
  focusSessionRemaining,
  pauseFocusSession,
  resumeFocusSession,
  startFocusSession,
} from './focusSession'

describe('focus execution session', () => {
  it('counts down while running', () => {
    const session =
      startFocusSession(
        'task-1',
        120,
        1_000,
      )

    expect(
      focusSessionRemaining(
        session,
        31_000,
      ),
    ).toBe(90)
  })

  it('freezes remaining time while paused', () => {
    const started =
      startFocusSession(
        'task-1',
        120,
        1_000,
      )
    const paused =
      pauseFocusSession(
        started,
        21_000,
      )

    expect(
      paused.remainingSeconds,
    ).toBe(100)
    expect(
      focusSessionRemaining(
        paused,
        121_000,
      ),
    ).toBe(100)
  })

  it('resumes from the frozen value', () => {
    const started =
      startFocusSession(
        'task-1',
        120,
        1_000,
      )
    const paused =
      pauseFocusSession(
        started,
        21_000,
      )
    const resumed =
      resumeFocusSession(
        paused,
        101_000,
      )

    expect(
      focusSessionRemaining(
        resumed,
        131_000,
      ),
    ).toBe(70)
  })

  it('never produces negative remaining time', () => {
    const session =
      startFocusSession(
        'task-1',
        5,
        1_000,
      )

    expect(
      focusSessionRemaining(
        session,
        60_000,
      ),
    ).toBe(0)
  })
})
