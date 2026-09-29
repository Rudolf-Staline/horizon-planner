import { describe, expect, it } from 'vitest'
import type { PlannerEvent } from './types'
import { applySeriesEdit } from './seriesEditing'

const series = 'a1c82a65-32ac-4e68-92e1-0a716e63da22'
const make = (id: string, date: string): PlannerEvent => ({
  id, taskId: id, seriesId: series, entityType: 'task',
  segmentIndex: 0, segmentCount: 1,
  title: 'Réviser', date, day: 0, startMin: 540,
  durationMin: 60, category: 'focus', kind: 'fixed',
})
const events = [
  make('a', '2026-09-28'),
  make('b', '2026-09-30'),
  make('c', '2026-10-02'),
  { ...make('other', '2026-10-02'), seriesId: 'different' },
]

describe('series editing', () => {
  it('changes only the selected occurrence', () => {
    const result = applySeriesEdit(events, 'b', { startMin: 840 }, 'one')
    expect(result.map((item) => item.startMin)).toEqual([540, 840, 540, 540])
  })

  it('shifts this and following dates without collapsing spacing', () => {
    const result = applySeriesEdit(
      events, 'b', { date: '2026-10-01', startMin: 840 }, 'following',
    )
    expect(result.map((item) => item.date))
      .toEqual(['2026-09-28', '2026-10-01', '2026-10-03', '2026-10-02'])
    expect(result.map((item) => item.startMin)).toEqual([540, 840, 840, 540])
    expect(result[2].day).toBe(5)
  })

  it('moves the complete series across a month boundary', () => {
    const result = applySeriesEdit(
      events, 'b', { date: '2026-10-02', durationMin: 225 }, 'all',
    )
    expect(result.map((item) => item.date))
      .toEqual(['2026-09-30', '2026-10-02', '2026-10-04', '2026-10-02'])
    expect(result.map((item) => item.durationMin)).toEqual([225, 225, 225, 60])
  })
})
