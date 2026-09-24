import { describe, expect, it } from 'vitest'
import { parseQuickTask } from './naturalLanguage'

describe('parseQuickTask', () => {
  it('parses duration, tomorrow and lower scheduling bound', () => {
    const parsed = parseQuickTask(
      'Demain réviser EDP 1h30 après 14h',
      2,
      13 * 60,
    )

    expect(parsed).not.toBeNull()
    expect(parsed!.day).toBe(3)
    expect(parsed!.durationMin).toBe(90)
    expect(parsed!.windowStartMin).toBe(14 * 60)
    expect(parsed!.category).toBe('course')
    expect(parsed!.kind).toBe('flexible')
  })

  it('recognizes a fixed meeting at an exact time', () => {
    const parsed = parseQuickTask(
      'Réunion groupe jeudi à 16h pendant 45 min',
      2,
      14 * 60,
    )

    expect(parsed).not.toBeNull()
    expect(parsed!.day).toBe(3)
    expect(parsed!.startMin).toBe(16 * 60)
    expect(parsed!.durationMin).toBe(45)
    expect(parsed!.kind).toBe('fixed')
    expect(parsed!.locked).toBe(true)
  })

  it('treats "avant vendredi" as a deadline, not the scheduled day', () => {
    const parsed = parseQuickTask(
      'Réviser probabilités 1h avant vendredi',
      2,
      14 * 60,
    )

    expect(parsed).not.toBeNull()
    expect(parsed!.day).toBe(2)
    expect(parsed!.deadlineDay).toBe(4)
  })

  it('turns evening language into a soft energy/time preference', () => {
    const parsed = parseQuickTask(
      'Lire 30 min dimanche soir',
      2,
      14 * 60,
    )

    expect(parsed).not.toBeNull()
    expect(parsed!.day).toBe(6)
    expect(parsed!.durationMin).toBe(30)
    expect(parsed!.energy).toBe('low')
    expect(parsed!.windowStartMin).toBe(18 * 60)
  })
})
