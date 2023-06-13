import { useGameAdapter } from '../Cpp'
import { registry } from '../components/registry'
import { IGameComponent } from '../components/types'

export function useComponents(): IGameComponent {
  const adapter = useGameAdapter()
  return registry[adapter.getCodename()] || {}
}
