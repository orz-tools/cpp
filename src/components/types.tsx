import React from 'react'

export interface IGameComponent {
  AboutCopyright?: React.FC
  AboutCredits?: React.FC
  ItemImportButton?: React.FC
  CharacterStatusPopover?: React.FC<{ character: any; isGoal: boolean }>
  renderCharacterStatus?: (status: any, character: any, current?: any, alreadyHide?: boolean) => any
}
