import deepEqual from 'deep-equal'

export interface StatusDiff<S> {
  key: string
  before: S | undefined
  after: S | undefined
}

/** The characters the import result dialog lists. compared is IUserDataAdapter.statusForImportDiff. */
export function statusDiffs<S extends object>(
  before: Record<string, S>,
  after: Record<string, S>,
  empty: S,
  compared: (status: S) => unknown = (status) => status,
): StatusDiff<S>[] {
  const diffs: StatusDiff<S>[] = []
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    // Data saved before a status field existed lacks its key; importing fills it in, which is not a change.
    const b = before[key] && compared({ ...empty, ...before[key] })
    const a = after[key] && compared({ ...empty, ...after[key] })
    if (deepEqual(b, a)) continue
    diffs.push({ key, before: before[key], after: after[key] })
  }
  return diffs
}
