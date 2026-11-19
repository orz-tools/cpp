import { Switch } from '@blueprintjs/core'
import { memo } from 'react'
import { setOwned } from '../../../pkg/cpp-arknights/statusEdit'
import { gt } from '../../../pkg/gt'
import { CachedImg } from '../../Icons'
import { CharacterPlanButtons } from '../../PlanActions'
import { StatusModeSwitch } from '../../StatusModeSwitch'
import { useEditor } from './context'

/**
 * The dossier already shows the avatar and the name above the editor, so embedded keeps only the mode and 持有.
 * 持有 is always there in the current status; in a goal only while the operator is not owned, to plan recruiting.
 * With onModeChange the mode becomes a switch on a row of its own: 360px holds no name, switch and 持有 in one row.
 * Beside 持有 the goal's 拉满 and 清空 show their icons alone, as the row has no room left for their text.
 */
export const Header = memo(
  ({
    isGoal,
    embedded,
    onModeChange,
  }: {
    isGoal: boolean
    embedded: boolean
    onModeChange?: (isGoal: boolean) => void
  }) => {
    const { character, status, current, setStatus } = useEditor()
    const showOwned = !current || current.level <= 0

    const identity = (
      <>
        <span className={`cpp-charstat-avatar cpp-char-rarity-${character.rarity}`}>
          <span className="cpp-char-avatar">
            <CachedImg src={character.avatar} width="100%" height="100%" alt="" />
          </span>
        </span>
        <div className="cpp-charstat-heading">
          <div className="cpp-charstat-name" title={character.name}>
            {character.name}
          </div>
          <div className="cpp-charstat-appellation" title={character.appellation}>
            {character.appellation}
          </div>
        </div>
      </>
    )
    const ownedSwitch = showOwned ? (
      <Switch
        className="cpp-charstat-owned"
        checked={status.level > 0}
        label={gt.gettext('持有')}
        onChange={(e) => {
          const owned = e.currentTarget.checked
          setStatus((x) => setOwned(x, owned))
        }}
      />
    ) : null

    if (onModeChange) {
      return (
        <>
          {embedded ? null : <div className="cpp-charstat-hd">{identity}</div>}
          <div className="cpp-charstat-modebar">
            <StatusModeSwitch isGoal={isGoal} onChange={onModeChange} />
            {ownedSwitch}
            {isGoal ? <CharacterPlanButtons charId={character.key} compact={showOwned} /> : null}
          </div>
        </>
      )
    }

    return (
      <div className={'cpp-charstat-hd' + (embedded ? ' cpp-charstat-hd-embedded' : '')}>
        {embedded ? null : identity}
        <div className="cpp-charstat-mode">
          {ownedSwitch}
          <b>{isGoal ? gt.gettext('培养目标') : gt.gettext('当前状态')}</b>
        </div>
      </div>
    )
  },
)
