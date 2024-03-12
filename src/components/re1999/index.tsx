import type { IGameComponent } from '../types'
import { AboutCopyright, AboutCredits, AboutDataSources, AboutThirdParty } from './AboutList'
import { CharacterContextMenuItems } from './CharacterContextMenuItems'
import { CharacterStatusPopover } from './CharacterStatusPopover'
import { renderCharacterStatus } from './renderCharacterStatus'
import style from './style.css?inline'

export const Re1999Components: IGameComponent = {
  email: 'cpp9@ouomail.com',
  AboutCopyright,
  AboutDataSources,
  AboutThirdParty,
  AboutCredits,
  CharacterContextMenuItems,
  CharacterStatusPopover,
  renderCharacterStatus,
  charStatusWidth: 43 * 2,
  style,
  itemSimulatedViewConfig: { limit: 6, horizontal: false, viewMaxSize: 1000 },
  blobFlavours: ['soul', 'normal'],
}
