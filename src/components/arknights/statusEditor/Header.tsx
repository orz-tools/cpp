import { Switch } from '@blueprintjs/core'
import { memo } from 'react'
import { setOwned } from '../../../pkg/cpp-arknights/statusEdit'
import { gt } from '../../../pkg/gt'
import { CachedImg } from '../../Icons'
import { useEditor } from './context'

/**
 * The dossier already shows the avatar and the name above the editor, so embedded keeps only the mode and 持有.
 * 持有 is always there in the current status; in a goal only while the operator is not owned, to plan recruiting.
 */
export const Header = memo(({ isGoal, embedded }: { isGoal: boolean; embedded: boolean }) => {
  const { character, status, current, setStatus } = useEditor()
  const showOwned = !current || current.level <= 0

  return (
    <div className={'cpp-charstat-hd' + (embedded ? ' cpp-charstat-hd-embedded' : '')}>
      {embedded ? null : (
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
      )}
      <div className="cpp-charstat-mode">
        {showOwned ? (
          <Switch
            className="cpp-charstat-owned"
            checked={status.level > 0}
            label={gt.gettext('持有')}
            onChange={(e) => {
              const owned = e.currentTarget.checked
              setStatus((x) => setOwned(x, owned))
            }}
          />
        ) : null}
        <b>{isGoal ? gt.gettext('培养目标') : gt.gettext('当前状态')}</b>
      </div>
    </div>
  )
})
