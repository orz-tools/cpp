import type { IGameComponent } from '../types'
import { AboutCopyright, AboutCredits, AboutDataSources, AboutThirdParty } from './AboutList'
import { CharacterContextMenuItems } from './CharacterContextMenuItems'
import { CharacterStatusPopover } from './CharacterStatusPopover'
import { ImporterMenuItems } from './ImporterMenuItems'
import { extraFields } from './extraFields'
import { renderCharacterStatus } from './renderCharacterStatus'
import style from './style.css?inline'

export const ArknightsComponents: IGameComponent = {
  email: 'cppa@ouomail.com',
  AboutCopyright,
  AboutDataSources,
  AboutThirdParty,
  AboutCredits,
  CharacterContextMenuItems,
  CharacterStatusPopover,
  renderCharacterStatus,
  itemSimulatedViewConfig: { limit: 3, horizontal: true, viewMaxSize: 500 },
  blobFlavours: ['normal'],
  ImporterMenuItems,
  style,
  extraFields: extraFields,
}
