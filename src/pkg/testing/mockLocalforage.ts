import { vi } from 'vitest'

vi.mock('localforage', () => {
  const memory = new Map<string, unknown>()

  const instance = {
    getItem: vi.fn(<T>(key: string): Promise<T | null> => {
      return Promise.resolve(memory.has(key) ? (memory.get(key) as T) : null)
    }),
    setItem: vi.fn((key: string, value: unknown) => {
      memory.set(key, value)
      return Promise.resolve(value)
    }),
    removeItem: vi.fn((key: string) => {
      memory.delete(key)
      return Promise.resolve()
    }),
  }

  return {
    default: {
      createInstance: vi.fn(() => instance),
      dropInstance: vi.fn(() => Promise.resolve()),
    },
  }
})
