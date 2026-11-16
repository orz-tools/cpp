import localForage from 'localforage'

// Per-profile data that is not user data: kept out of localStorage (shared ~5 MB, and the user data atom
// re-serialises everything on each edit) and out of undo history. One record per profile, keyed by the
// profile's storage prefix, so the save manager can export and clear it without knowing what is inside.
const store = localForage.createInstance({
  name: 'cpp_extras',
})

// Each profile's reads and writes run one after another, so a read-modify-write never interleaves with
// another, and a write issued later always lands later (an undo issued right after an import, say).
const queues = new Map<string, Promise<unknown>>()

function enqueue<T>(prefix: string, task: () => Promise<T>): Promise<T> {
  const run = (queues.get(prefix) ?? Promise.resolve()).then(task, task)
  queues.set(
    prefix,
    run.catch(() => undefined),
  )
  return run
}

async function load(prefix: string): Promise<Record<string, unknown>> {
  const record = await store.getItem<Record<string, unknown>>(prefix)
  return record && typeof record === 'object' ? record : {}
}

async function save(prefix: string, record: Record<string, unknown>) {
  if (Object.keys(record).length > 0) {
    await store.setItem(prefix, record)
  } else {
    await store.removeItem(prefix)
  }
}

export function loadProfileExtras(prefix: string): Promise<Record<string, unknown>> {
  return enqueue(prefix, () => load(prefix))
}

/** undefined removes the entry. */
export function saveProfileExtra(prefix: string, name: string, value: unknown): Promise<void> {
  return enqueue(prefix, async () => {
    const record = await load(prefix)
    if (value === undefined) {
      delete record[name]
    } else {
      record[name] = value
    }
    await save(prefix, record)
  })
}

/** Replaces the whole record; undefined clears it. Resolves to the record it replaced. */
export function replaceProfileExtras(
  prefix: string,
  extras: Record<string, unknown> | undefined,
): Promise<Record<string, unknown>> {
  return enqueue(prefix, async () => {
    const old = await load(prefix)
    await save(prefix, extras ?? {})
    return old
  })
}
