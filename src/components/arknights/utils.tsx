import { ArknightsAdapter } from '../../pkg/cpp-arknights/GameAdapter'
import { IGameAdapter } from '../../pkg/cpp-basic'

export function isArknights(ga: IGameAdapter<any>): ga is ArknightsAdapter {
  return ga.getCodename() === ArknightsAdapter.codename
}
