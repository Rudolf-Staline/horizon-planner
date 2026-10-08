import { describe, expect, it } from 'vitest'
import { allPages } from './pagination'
describe('complete account reads', () => {
  it('keeps all rows across the API limit', async () => {
    const values = Array.from({ length: 1201 }, (_, id) => ({ id }))
    const result = await allPages((from, to) => Promise.resolve({ data: values.slice(from, to + 1), error: null }))
    expect(result.data).toEqual(values)
  })
  it('rejects a partial snapshot when a later page fails', async () => {
    const error = { message: 'offline' }
    const result = await allPages((from) => Promise.resolve({ data: from ? null : [{ id: 1 }], error: from ? error : null }), 1)
    expect(result).toEqual({ data: [], error })
  })
})
