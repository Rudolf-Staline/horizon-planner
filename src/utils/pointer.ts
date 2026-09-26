export function edgeScrollDelta(
  position: number,
  start: number,
  end: number,
  threshold = 72,
  maxStep = 24,
) {
  if (
    !Number.isFinite(position) ||
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    end <= start ||
    threshold <= 0 ||
    maxStep <= 0
  ) {
    return 0
  }

  const safeThreshold = Math.min(
    threshold,
    (end - start) / 2,
  )

  if (
    position <
    start + safeThreshold
  ) {
    const ratio = Math.min(
      1,
      Math.max(
        0,
        (
          start +
          safeThreshold -
          position
        ) / safeThreshold,
      ),
    )

    return -Math.ceil(
      maxStep * ratio,
    )
  }

  if (
    position >
    end - safeThreshold
  ) {
    const ratio = Math.min(
      1,
      Math.max(
        0,
        (
          position -
          (end - safeThreshold)
        ) / safeThreshold,
      ),
    )

    return Math.ceil(
      maxStep * ratio,
    )
  }

  return 0
}
