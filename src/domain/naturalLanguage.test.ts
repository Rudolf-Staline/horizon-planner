import { describe, expect, it } from 'vitest'
import { parseQuickTask } from './naturalLanguage'

describe('parseQuickTask', () => {
  it('parses duration, tomorrow and lower scheduling bound', () => {
    const parsed = parseQuickTask(
      'Demain réviser EDP 1h30 après 14h',
      '2026-09-23',
      13 * 60,
    )

    expect(parsed).not.toBeNull()
    expect(parsed!.date).toBe('2026-09-24')
    expect(parsed!.day).toBe(3)
    expect(parsed!.durationMin).toBe(90)
    expect(parsed!.windowStartMin).toBe(14 * 60)
    expect(parsed!.category).toBe('course')
    expect(parsed!.kind).toBe('flexible')
  })

  it('recognizes a fixed meeting at an exact time', () => {
    const parsed = parseQuickTask(
      'Réunion groupe jeudi à 16h pendant 45 min',
      '2026-09-23',
      14 * 60,
    )

    expect(parsed).not.toBeNull()
    expect(parsed!.date).toBe('2026-09-24')
    expect(parsed!.day).toBe(3)
    expect(parsed!.startMin).toBe(16 * 60)
    expect(parsed!.durationMin).toBe(45)
    expect(parsed!.kind).toBe('fixed')
    expect(parsed!.locked).toBe(true)
    expect(parsed!.deadlineDate).toBeUndefined()
  })

  it('treats "avant vendredi" as a deadline, not the scheduled day', () => {
    const parsed = parseQuickTask(
      'Réviser probabilités 1h avant vendredi',
      '2026-09-23',
      14 * 60,
    )

    expect(parsed).not.toBeNull()
    expect(parsed!.date).toBe('2026-09-23')
    expect(parsed!.deadlineDate).toBe('2026-09-25')
    expect(parsed!.deadlineDay).toBe(4)
    expect(parsed!.title).toBe('Réviser probabilités')
  })

  it('turns evening language into a soft energy/time preference', () => {
    const parsed = parseQuickTask(
      'Lire 30 min dimanche soir',
      '2026-09-23',
      14 * 60,
    )

    expect(parsed).not.toBeNull()
    expect(parsed!.date).toBe('2026-09-27')
    expect(parsed!.day).toBe(6)
    expect(parsed!.durationMin).toBe(30)
    expect(parsed!.energy).toBe('low')
    expect(parsed!.windowStartMin).toBe(18 * 60)
  })

  it('moves tomorrow across the Sunday boundary', () => {
    const parsed = parseQuickTask(
      'Demain préparer la semaine 1h',
      '2026-09-27',
      18 * 60,
    )

    expect(parsed).not.toBeNull()
    expect(parsed!.date).toBe('2026-09-28')
    expect(parsed!.day).toBe(0)
    expect(parsed!.deadlineDate).toBe('2026-09-30')
  })

  it('resolves a named weekday to the next occurrence', () => {
    const parsed = parseQuickTask(
      'Lundi réviser EDP 1h',
      '2026-09-25',
      15 * 60,
    )

    expect(parsed).not.toBeNull()
    expect(parsed!.date).toBe('2026-09-28')
    expect(parsed!.day).toBe(0)
  })
})
