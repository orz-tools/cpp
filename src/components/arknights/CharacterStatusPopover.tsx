import { memo } from 'react'
import { Character } from '../../pkg/cpp-arknights'
import { CharacterStatusEditor } from './statusEditor/CharacterStatusEditor'

export const CharacterStatusPopover = memo(
  ({ character, isGoal, embedded }: { character: Character; isGoal: boolean; embedded?: boolean }) => (
    <CharacterStatusEditor character={character} isGoal={isGoal} embedded={embedded} />
  ),
)
