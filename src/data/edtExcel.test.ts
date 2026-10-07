import { describe, expect, it } from 'vitest'
import { edtChanges, emptyGroups, initialEdt, parseEdtSheets, reconcileSemester, selectEdt } from './edtExcel'

describe('semester timetable', () => {
  it('extracts all weeks with corrected semester dates and unique source keys', () => {
    expect(initialEdt.entries.length).toBeGreaterThan(900)
    expect(new Set(initialEdt.entries.map(e => e.externalId)).size).toBe(initialEdt.entries.length)
    expect(initialEdt.entries.every(e => e.date! >= '2026-09-01' && e.date! <= '2027-02-05')).toBe(true)
    expect(initialEdt.entries.some(e => e.date === '2027-02-01' && /Rattrapages/.test(e.title))).toBe(true)
  })
  it('selects common sessions and only the chosen groups', () => {
    const selected = selectEdt(initialEdt.entries, {...emptyGroups, TD: '3', LANG: '7', DI:'1'})
    expect(selected.some(e => e.groups.includes('TD3'))).toBe(true)
    expect(selected.some(e => e.groups.includes('LANG7'))).toBe(true)
    expect(selected.every(e => !e.groups.length || e.groups.some(g => ['TD3', 'LANG7', 'DI1'].includes(g)))).toBe(true)
    expect(selectEdt(initialEdt.entries, emptyGroups).every(e => !e.groups.length)).toBe(true)
  })
  it('honors explicit times and vertical merged sessions', () => {
    const { entries } = parseEdtSheets([{name:'test',cells:{B4:'2026-10-07',B5:'Atelier 9h00 à 10h00',D4:'2026-10-08',D19:'Projet'},merges:['D19:E31']}])
    expect(entries[0].startMin).toBe(540)
    expect(entries[0].durationMin).toBe(60)
    expect(entries[1].durationMin).toBe(225)
  })
  it('detects moves, removals, additions and repeated imports', () => {
    const original = initialEdt.entries.slice(0, 3)
    expect(edtChanges(original, original)).toEqual({added:0,changed:0,removed:0})
    expect(edtChanges(original,[{...original[0],startMin:600},original[2],initialEdt.entries[3]])).toEqual({added:1,changed:1,removed:1})
  })
  it('updates matching sessions, removes only this semester and preserves other events', () => {
    const old = { ...initialEdt.entries[0], id: crypto.randomUUID() }
    const personal = { ...old, id: crypto.randomUUID(), externalId: undefined, title: 'Personal' }
    const moved = { ...old, startMin: 600 }
    const next = reconcileSemester([old, personal, initialEdt.entries[1]], [moved, moved])
    expect(next).toHaveLength(2)
    expect(next).toContainEqual(personal)
    expect(next.find(e => e.externalId === old.externalId)).toMatchObject({id:old.id, startMin:600})
    expect(reconcileSemester(next, [moved])).toEqual(next)
  })
  it('rejects an empty or unrelated workbook', () => {
    expect(() => parseEdtSheets([{name:'Other',cells:{A1:'Hello'},merges:[]}])).toThrow('Aucune séance')
  })
})
