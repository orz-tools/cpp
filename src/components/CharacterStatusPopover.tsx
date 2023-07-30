import { Button } from '@blueprintjs/core'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import React from 'react'
import useEvent from 'react-use-event-hook'
import { useAtoms } from '../Cpp'
import { ICharacter, IGame } from '../pkg/cpp-basic'
import { UserDataAtomHolder } from '../pkg/cpp-core/UserData'

const useTypeHolderForSetStatusAtom = () =>
  useSetAtom(null as any as ReturnType<UserDataAtomHolder<IGame>['atoms']['goalCharacter']>)

const EditorContext = React.createContext<{
  status: IGame['characterStatus']
  currentStatus?: IGame['characterStatus']
  setStatus: ReturnType<typeof useTypeHolderForSetStatusAtom>
  character: ICharacter
}>(undefined as any)

export function CharacterStatusPopover<G extends IGame>({
  character,
  isGoal,
}: {
  character: ICharacter
  isGoal: boolean
}) {
  const atoms = useAtoms<G>()
  const charId = character.key
  const statusAtom = isGoal ? atoms.goalCharacter(charId) : atoms.currentCharacter(charId)
  const [status, setStatus] = useAtom(statusAtom)
  let currentStatus: G['characterStatus'] | undefined = useAtomValue(atoms.currentCharacter(charId))
  if (!isGoal) currentStatus = undefined
  const ctx = { status, setStatus, character, currentStatus }

  const handleEdit = useEvent(() => {
    setStatus((draft) => {
      try {
        const v = prompt('input new status', JSON.stringify(draft))
        if (!v) return draft
        const vv = JSON.parse(v)
        if (typeof vv !== 'object') throw new Error('bad status')
        return vv
      } catch (e: any) {
        alert(e?.message || e?.stack || String(e))
        return draft
      }
    })
  })

  return (
    <EditorContext.Provider value={ctx}>
      <div>
        {character.name} - {isGoal ? '培养目标' : '当前状态'}
      </div>
      <pre style={{ wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>{JSON.stringify(status)}</pre>
      <Button text={'update'} onClick={handleEdit} />
    </EditorContext.Provider>
  )
}
