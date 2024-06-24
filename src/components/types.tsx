import React from 'react'
import { BlobFlavour } from '../pkg/blobcache'
import { FieldContext, ICharacter, Querier } from '../pkg/cpp-basic'

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
  charStatusWidth?: number
  style?: string
  itemSimulatedViewConfig?: ItemSimulatedViewConfig
  blobFlavours?: BlobFlavour[]
  ImporterMenuItems?: React.FC
  ExporterMenuItems?: React.FC
  extraFields?: Record<
    string,
    { width: number; C: React.FC<{ query: Querier<any, any>; context: FieldContext<any, any, any> }> }
  >
  TaskDisplay?: React.FC<{ type: any; charId: string; formattedString: string }>
  QuickFilterBuilder?: React.FC
  quickFilters?: Record<string, string>
}
