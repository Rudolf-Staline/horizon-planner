export interface FocusSession {
  eventId: string
  remainingSeconds: number
  paused: boolean
  updatedAtMs: number
}

export function startFocusSession(
  eventId: string,
  remainingSeconds: number,
  nowMs: number,
): FocusSession {
  return {
    eventId,
    remainingSeconds:
      Math.max(
        0,
        Math.floor(
          remainingSeconds,
        ),
      ),
    paused: false,
    updatedAtMs: nowMs,
  }
}

export function focusSessionRemaining(
  session: FocusSession,
  nowMs: number,
) {
  if (session.paused) {
    return session.remainingSeconds
  }

  const elapsedSeconds =
    Math.max(
      0,
      Math.floor(
        (
          nowMs -
          session.updatedAtMs
        ) / 1000,
      ),
    )

  return Math.max(
    0,
    session.remainingSeconds -
      elapsedSeconds,
  )
}

export function pauseFocusSession(
  session: FocusSession,
  nowMs: number,
): FocusSession {
  return {
    ...session,
    remainingSeconds:
      focusSessionRemaining(
        session,
        nowMs,
      ),
    paused: true,
    updatedAtMs: nowMs,
  }
}

export function resumeFocusSession(
  session: FocusSession,
  nowMs: number,
): FocusSession {
  return {
    ...session,
    paused: false,
    updatedAtMs: nowMs,
  }
}
