import { ArknightsAdapter } from '../pkg/cpp-arknights/GameAdapter'
import { ArknightsComponents } from './arknights'
import { IGameComponent } from './types'

export const registry: Record<string, IGameComponent> = {}

registry[ArknightsAdapter.codename] = ArknightsComponents
