import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import React from 'react'
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

  return (
    <EditorContext.Provider value={ctx}>
      <div>
        {character.name} - {isGoal ? '培养目标' : '当前状态'}
      </div>
      {JSON.stringify(status)}
    </EditorContext.Provider>
  )
}
