/** Read complete account collections; a partial failed read must never be
 * interpreted as an authoritative snapshot by the synchronization layer. */
export async function allPages<T, E>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: E | null }>, pageSize = 500): Promise<{ data: T[]; error: E | null }> {
  const data: T[] = []
  for (let from = 0; ; from += pageSize) {
    const result = await fetchPage(from, from + pageSize - 1)
    if (result.error) return { data: [], error: result.error }
    data.push(...(result.data ?? []))
    if (!result.data || result.data.length < pageSize) return { data, error: null }
  }
}
