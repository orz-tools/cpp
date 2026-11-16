import React from 'react'
import { BlobFlavour } from '../pkg/blobcache'
import { FieldContext, ICharacter, Querier } from '../pkg/cpp-basic'
import type { ImportFormat } from './Importer'

export interface ItemSimulatedViewConfig {
  limit: number
  horizontal: boolean
  viewMaxSize: number
}

export interface IGameComponent {
  email?: string
  AboutCopyright?: React.FC
  AboutThirdParty?: React.FC
  AboutCredits?: React.FC
  AboutDataSources?: React.FC
  CharacterContextMenuItems?: React.FC<{ character: ICharacter }>
  CharacterStatusPopover?: React.FC<{ character: any; isGoal: boolean }>
  renderCharacterStatus?: (status: any, character: any, current?: any, alreadyHide?: boolean) => any
  renderCharacterAvatarBadge?: (status: any, character: any) => any
  charStatusWidth?: number
  style?: string
  itemSimulatedViewConfig?: ItemSimulatedViewConfig
  blobFlavours?: BlobFlavour[]
  ImporterMenuItems?: React.FC
  ExporterMenuItems?: React.FC
  ConfigMenuItems?: React.FC
  /** A hook: the formats the import paste box tries after Closure++'s own, in order */
  useImportFormats?: () => ImportFormat[]
  extraFields?: Record<
    string,
    {
      /** 默认宽度；过滤器可以改，所以 C 按传入的 width 画 */
      width: number
      C: React.FC<{ query: Querier<any, any>; context: FieldContext<any, any, any>; width: number }>
    }
  >
  TaskDisplay?: React.FC<{ type: any; charId: string; formattedString: string }>
  QuickFilterBuilder?: React.FC
  ValueConfigMenu?: React.FC
  quickFilters?: Record<string, string>
}
