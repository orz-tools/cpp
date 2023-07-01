import type { IGameComponent } from '../types'
import { AboutCopyright, AboutCredits } from './AboutList'
import { CharacterStatusPopover } from './CharacterStatusPopover'
import { ItemImportButton } from './ItemList'
import { renderCharacterStatus } from './renderCharacterStatus'

export const ArknightsComponents: IGameComponent = {
  AboutCopyright,
  AboutCredits,
  ItemImportButton,
  CharacterStatusPopover,
  renderCharacterStatus,
  itemSimulatedViewConfig: { limit: 3, horizontal: true, viewMaxSize: 500 },
}
