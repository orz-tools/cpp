import type { Cpp } from '../../Cpp'
import { QueryParam } from '../../pkg/cpp-basic'

// 都经 dataAtom 的 immer 写入，与 starredTasks 一样进入撤销/重做

export function saveAs(cpp: Cpp<any>, name: string, query: QueryParam): string {
  const id = crypto.randomUUID()
  cpp.store.set(cpp.atoms.atoms.dataAtom, 'modify', (draft) => {
    draft.savedQueries.push({ id, name, query })
  })
  return id
}

export function overwrite(cpp: Cpp<any>, id: string, query: QueryParam) {
  cpp.store.set(cpp.atoms.atoms.dataAtom, 'modify', (draft) => {
    const saved = draft.savedQueries.find((x) => x.id === id)
    if (saved) saved.query = query
  })
}

export function rename(cpp: Cpp<any>, id: string, name: string) {
  cpp.store.set(cpp.atoms.atoms.dataAtom, 'modify', (draft) => {
    const saved = draft.savedQueries.find((x) => x.id === id)
    if (saved) saved.name = name
  })
}

export function remove(cpp: Cpp<any>, id: string) {
  cpp.store.set(cpp.atoms.atoms.dataAtom, 'modify', (draft) => {
    draft.savedQueries = draft.savedQueries.filter((x) => x.id !== id)
  })
}

export function setFavQuery(cpp: Cpp<any>, query: QueryParam | undefined) {
  cpp.store.set(cpp.atoms.atoms.dataAtom, 'modify', (draft) => {
    if (query) draft.favQuery = query
    else delete draft.favQuery
  })
}
