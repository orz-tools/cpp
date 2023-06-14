import { useCpp } from '../Cpp'
import { IGameComponent } from '../components/types'

export function useComponents(): IGameComponent {
  return useCpp().gameComponent || {}
}
