import { Button } from '@blueprintjs/core'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import React, { memo } from 'react'
import useEvent from 'react-use-event-hook'
import { useAtoms } from '../Cpp'
import { ICharacter, IGame } from '../pkg/cpp-basic'
import { UserDataAtomHolder } from '../pkg/cpp-core/UserData'
import { gt } from '../pkg/gt'
import { showAlert, showPrompt } from './MessageBox'
import { StatusModeSwitch } from './StatusModeSwitch'

const useTypeHolderForSetStatusAtom = () =>
  useSetAtom(null as any as ReturnType<UserDataAtomHolder<IGame>['atoms']['goalCharacter']>)

const EditorContext = React.createContext<{
  status: IGame['characterStatus']
  currentStatus?: IGame['characterStatus']
  setStatus: ReturnType<typeof useTypeHolderForSetStatusAtom>
  character: ICharacter
}>(undefined as any)

export const CharacterStatusPopover = memo(
  <G extends IGame>({
    character,
    isGoal,
    embedded,
    onModeChange,
  }: {
    character: ICharacter
    isGoal: boolean
    embedded?: boolean
    onModeChange?: (isGoal: boolean) => void
  }) => {
    const atoms = useAtoms<G>()
    const charId = character.key
    const statusAtom = isGoal ? atoms.goalCharacter(charId) : atoms.currentCharacter(charId)
    const [status, setStatus] = useAtom(statusAtom)
    let currentStatus: G['characterStatus'] | undefined = useAtomValue(atoms.currentCharacter(charId))
    if (!isGoal) currentStatus = undefined
    const ctx = { status, setStatus, character, currentStatus }

    const handleEdit = useEvent(async () => {
      const v = await showPrompt('input new status', JSON.stringify(status))
      if (!v) return
      try {
        const vv = JSON.parse(v)
        if (typeof vv !== 'object') throw new Error('bad status')
        setStatus(() => vv)
      } catch (e: any) {
        void showAlert(e?.message || e?.stack || String(e))
      }
    })

    return (
      <EditorContext.Provider value={ctx}>
        <div>
          {/* The dossier already names the character in its header */}
          {embedded ? null : `${character.name} - `}
          {onModeChange ? (
            <StatusModeSwitch isGoal={isGoal} onChange={onModeChange} />
          ) : isGoal ? (
            gt.gettext('培养目标')
          ) : (
            gt.gettext('当前状态')
          )}
        </div>
        <pre style={{ wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>{JSON.stringify(status)}</pre>
        <Button text={'update'} onClick={() => void handleEdit()} />
      </EditorContext.Provider>
    )
  },
)
