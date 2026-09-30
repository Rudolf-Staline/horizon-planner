import { describe, expect, it, vi } from 'vitest'
import fixture from './fixtures/edt-september-2026.json'
import { parseEtdPdf } from './edtPdf'

vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
  GlobalWorkerOptions: {},
  getDocument: () => ({ promise: Promise.resolve({
    numPages: 1,
    getPage: async () => ({
      getViewport: () => ({ height: fixture.height }),
      getTextContent: async () => ({ items: fixture.items }),
    }),
  }) }),
}))

const file = new File(['fixture'], 'planning.pdf', { type: 'application/pdf' })
describe('weekly PDF import using the supplied timetable text and coordinates', () => {
  it('recognizes future groups and produces database-compatible UUIDs', async () => {
    const result = await parseEtdPdf(file, 'Africa/Casablanca', new Date('2026-09-30T04:00:00Z'))
    expect(result.weekStart).toBe('2026-09-28')
    expect(result.candidates.length).toBeGreaterThan(30)
    expect(result.candidates.some(event => event.selectionLabel === 'G1')).toBe(true)
    expect(result.candidates.some(event => event.selectionLabel === 'CPV1')).toBe(true)
    for (const event of result.candidates) {
      expect(event.id).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i)
      expect(event.date! >= '2026-09-30').toBe(true)
    }
    expect(new Set(result.candidates.map(event => event.externalId)).size).toBe(result.candidates.length)
  })
  it('keeps stable external identities across successive imports', async () => {
    const now = new Date('2026-09-30T04:00:00Z')
    const first = await parseEtdPdf(file, 'Africa/Casablanca', now)
    const second = await parseEtdPdf(file, 'Africa/Casablanca', now)
    expect(second.candidates.map(event => event.externalId)).toEqual(first.candidates.map(event => event.externalId))
    expect(second.candidates[0].id).not.toBe(first.candidates[0].id)
  })
  it('offers no elapsed courses after the week ends', async () => {
    expect((await parseEtdPdf(file, 'Africa/Casablanca', new Date('2026-10-03T00:00:00Z'))).candidates).toEqual([])
  })
})
