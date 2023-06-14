import type { IGameComponent } from '../types'
import { AboutCopyright, AboutCredits } from './AboutList'
import { CharacterStatusPopover } from './CharacterStatusPopover'
import { renderCharacterStatus } from './renderCharacterStatus'
import style from './style.css?inline'

export const Re1999Components: IGameComponent = {
  AboutCopyright,
  AboutCredits,
  CharacterStatusPopover,
  renderCharacterStatus,
  charStatusWidth: 43 * 2,
  style,
}
