import type { IGameComponent } from '../types'
import { AboutCopyright, AboutCredits, AboutDataSources, AboutThirdParty } from './AboutList'
import { CharacterContextMenuItems } from './CharacterContextMenuItems'
import { CharacterStatusPopover } from './CharacterStatusPopover'
import { ItemImportButton } from './ItemList'
import { renderCharacterStatus } from './renderCharacterStatus'

export const ArknightsComponents: IGameComponent = {
  AboutCopyright,
  AboutDataSources,
  AboutThirdParty,
  AboutCredits,
  CharacterContextMenuItems,
  ItemImportButton,
  CharacterStatusPopover,
  renderCharacterStatus,
  itemSimulatedViewConfig: { limit: 3, horizontal: true, viewMaxSize: 500 },
}
