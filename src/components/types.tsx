import React from 'react'

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
  ItemImportButton?: React.FC
  CharacterStatusPopover?: React.FC<{ character: any; isGoal: boolean }>
  renderCharacterStatus?: (status: any, character: any, current?: any, alreadyHide?: boolean) => any
  charStatusWidth?: number
  style?: string
  itemSimulatedViewConfig?: ItemSimulatedViewConfig
}
