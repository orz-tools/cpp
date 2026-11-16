import { MenuItem } from '@blueprintjs/core'
import { memo } from 'react'
import { WithGame } from '../../Cpp'
import { Arknights, PreferenceKeys } from '../../pkg/cpp-arknights'
import { gt } from '../../pkg/gt'

export const ConfigMenuItems = memo(() => {
  const [showPotential, setShowPotential] = WithGame<Arknights>().useGamePreferenceAtom(PreferenceKeys.ShowPotential)
  return (
    <MenuItem
      icon={showPotential ? 'tick' : 'blank'}
      text={gt.pgettext('arknights option', '显示潜能')}
      onClick={() => setShowPotential(!showPotential)}
    />
  )
})
