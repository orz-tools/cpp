import { memo } from 'react'
import { Character } from '../../pkg/cpp-arknights'
import { CharacterStatusEditor } from './statusEditor/CharacterStatusEditor'

export const CharacterStatusPopover = memo(
  ({
    character,
    isGoal,
    embedded,
    onModeChange,
  }: {
    character: Character
    isGoal: boolean
    embedded?: boolean
    onModeChange?: (isGoal: boolean) => void
  }) => <CharacterStatusEditor character={character} isGoal={isGoal} embedded={embedded} onModeChange={onModeChange} />,
)
