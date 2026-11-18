import type { IGameComponent } from '../types'
import { AboutCopyright, AboutCredits, AboutDataSources, AboutThirdParty } from './AboutList'
import { CharacterContextMenuItems } from './CharacterContextMenuItems'
import { CharacterDossierMeta } from './CharacterDossierMeta'
import { CharacterStatusPopover } from './CharacterStatusPopover'
import { baseSkillsSection } from './BaseSkillSection'
import { costSection } from './CostSection'
import { ConfigMenuItems } from './ConfigMenuItems'
import { ExporterMenuItems } from './ExporterMenuItems'
import { ImporterMenuItems } from './ImporterMenuItems'
import { moduleMissionsPanel } from './ModuleMissionPanel'
import { moduleMissionsSection } from './ModuleMissionSection'
import { QuickFilterBuilder } from './QuickFilterBuilder'
import { skinsPanel } from './SkinsPanel'
import { skinsSection } from './SkinsSection'
import { specialOperatorSection } from './SpecialOperatorSection'
import { stagesPanel } from './StagePanel'
import { TaskDisplay } from './TaskDisplay'
import { ValueConfigMenu } from './ValueConfigMenu'
import { extraFields } from './extraFields'
import { modulePeekKind, skillPeekKind, stagePeekKind } from './peekKinds'
import { useArknightsImportFormats } from './importFormats'
import { renderCharacterAvatarBadge, renderCharacterStatus } from './renderCharacterStatus'
import style from './style.css?inline'
import { taskNotes } from './taskNotes'

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
  // 十个房间按钮放不下职业和精英化
  quickFiltersByJoin: {
    building: { 'building.room': '==', rarity: '==' },
  },
  sidebarPanels: [stagesPanel, moduleMissionsPanel, skinsPanel],
  // 特殊干员没有「养成成本」，所以「特勤任务」紧跟「练度」
  dossierSections: [costSection, specialOperatorSection, baseSkillsSection, skinsSection, moduleMissionsSection],
  peekKinds: { skill: skillPeekKind, module: modulePeekKind, stage: stagePeekKind },
  taskNotes,
}
