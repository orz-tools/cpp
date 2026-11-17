import type { IGameComponent } from '../types'
import { AboutCopyright, AboutCredits, AboutDataSources, AboutThirdParty } from './AboutList'
import { CharacterContextMenuItems } from './CharacterContextMenuItems'
import { CharacterDossierMeta } from './CharacterDossierMeta'
import { CharacterStatusPopover } from './CharacterStatusPopover'
import { costSection } from './CostSection'
import { ConfigMenuItems } from './ConfigMenuItems'
import { ExporterMenuItems } from './ExporterMenuItems'
import { ImporterMenuItems } from './ImporterMenuItems'
import { moduleMissionsPanel } from './ModuleMissionPanel'
import { moduleMissionsSection } from './ModuleMissionSection'
import { QuickFilterBuilder } from './QuickFilterBuilder'
import { skinsPanel } from './SkinsPanel'
import { skinsSection } from './SkinsSection'
import { stagesPanel } from './StagePanel'
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
  CharacterDossierMeta,
  renderCharacterStatus,
  renderCharacterAvatarBadge,
  itemSimulatedViewConfig: { limit: 3, horizontal: true, viewMaxSize: 500 },
  blobFlavours: ['normal'],
  ImporterMenuItems,
  ExporterMenuItems,
  ConfigMenuItems,
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
  sidebarPanels: [stagesPanel, moduleMissionsPanel, skinsPanel],
  dossierSections: [costSection, skinsSection, moduleMissionsSection],
}
