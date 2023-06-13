import { ArknightsAdapter } from '../pkg/cpp-arknights/GameAdapter'
import { Re1999Adapter } from '../pkg/cpp-re1999/GameAdapter'
import { ArknightsComponents } from './arknights'
import { Re1999Components } from './re1999'
import { IGameComponent } from './types'

export const registry: Record<string, IGameComponent> = {}

registry[ArknightsAdapter.codename] = ArknightsComponents
registry[Re1999Adapter.codename] = Re1999Components
