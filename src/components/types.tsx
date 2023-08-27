import React from 'react'
import { ICharacter } from '../pkg/cpp-basic'

export interface ItemSimulatedViewConfig {
  limit: number
  horizontal: boolean
  viewMaxSize: number
}

export interface IGameComponent {
  AboutCopyright?: React.FC
  AboutThirdParty?: React.FC
  AboutCredits?: React.FC
  AboutDataSources?: React.FC
  CharacterImportButton?: React.FC
  ItemImportButton?: React.FC
  CharacterContextMenuItems?: React.FC<{ character: ICharacter }>
  CharacterStatusPopover?: React.FC<{ character: any; isGoal: boolean }>
  renderCharacterStatus?: (status: any, character: any, current?: any, alreadyHide?: boolean) => any
  charStatusWidth?: number
  style?: string
  itemSimulatedViewConfig?: ItemSimulatedViewConfig
}
