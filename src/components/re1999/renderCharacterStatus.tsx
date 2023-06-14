import { Character, Re1999 } from '../../pkg/cpp-re1999'
import { Hide } from '../CharacterList'
import { LevelIcon, ResonateIcon } from './Icons'

export function renderCharacterStatus(
  status: Re1999['characterStatus'],
  character: Character,
  current?: Re1999['characterStatus'],
  alreadyHide: boolean = false,
) {
  return (
    <>
      <Hide
        hide={current ? status.insight == current.insight && status.level == current.level : false}
        alreadyHide={alreadyHide}
      >
        <LevelIcon level={status} />
      </Hide>
      <Hide hide={current ? status.resonate == current.resonate : false} alreadyHide={alreadyHide}>
        <ResonateIcon level={status.resonate} />
      </Hide>
    </>
  )
}
