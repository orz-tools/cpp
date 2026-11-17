import { useEffect, useState } from 'react'
import { useGameDataGeneration } from '../../Cpp'
import type { ArknightsDataManager } from '../../pkg/cpp-arknights/DataManager'
import type { Details } from '../../pkg/cpp-arknights/details'

export type LoadedDetails = { details: Details } | { error: true } | null

/**
 * The details container, downloaded once however many panels and list cells ask for it: null while loading, and a
 * retry that downloads again after a failure.
 */
export function useDetails(dm: ArknightsDataManager) {
  const generation = useGameDataGeneration()
  const [attempt, setAttempt] = useState(0)
  // A result answers one request; until the one for newer game data or a retry arrives, the panel is loading.
  const request = `${generation}:${attempt}`
  const [result, setResult] = useState<{ request: string; loaded: LoadedDetails } | null>(null)
  useEffect(() => {
    let alive = true
    void dm.loadDetails().then(
      (details) => alive && setResult({ request, loaded: { details } }),
      (e) => {
        console.error('Failed to load the details', e)
        if (alive) setResult({ request, loaded: { error: true } })
      },
    )
    return () => {
      alive = false
    }
  }, [dm, request])
  return [result?.request === request ? result.loaded : null, () => setAttempt((x) => x + 1)] as const
}
