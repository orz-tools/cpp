import type { IGameComponent } from '../types'
import { AboutCopyright, AboutCredits, AboutDataSources, AboutThirdParty } from './AboutList'
import { CharacterContextMenuItems } from './CharacterContextMenuItems'
import { CharacterStatusPopover } from './CharacterStatusPopover'
import { ExporterMenuItems } from './ExporterMenuItems'
import { ImporterMenuItems } from './ImporterMenuItems'
import { QuickFilterBuilder } from './QuickFilterBuilder'
import { TaskDisplay } from './TaskDisplay'
import { ValueConfigMenu } from './ValueConfigMenu'
import { extraFields } from './extraFields'
import { useArknightsImportFormats } from './importFormats'
import { renderCharacterAvatarBadge, renderCharacterStatus } from './renderCharacterStatus'
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
  renderCharacterAvatarBadge,
  itemSimulatedViewConfig: { limit: 3, horizontal: true, viewMaxSize: 500 },
  blobFlavours: ['normal'],
  ImporterMenuItems,
  ExporterMenuItems,
  useImportFormats: useArknightsImportFormats,
  style,
  extraFields: extraFields,
  TaskDisplay,
  QuickFilterBuilder,
  ValueConfigMenu,
  quickFilters: {
    professions: 'contains',
    rarity: '==',
    elite: '==',
  },
}
