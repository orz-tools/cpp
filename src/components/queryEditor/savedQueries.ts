import type { Cpp } from '../../Cpp'
import { QueryParam } from '../../pkg/cpp-basic'
import { ListModeFav, PredefinedGameQueryPrefix, SavedQueryPrefix } from '../characterQuery'
import { presetRowKey } from '../presetMenu'

// 都经 dataAtom 的 immer 写入，除了列宽，都与 starredTasks 一样进入撤销/重做

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

/**
 * 不在编辑时改的列宽直接存进视图 ref：已保存的过滤器和自定义过的「常看」写回自己的查询，
 * 游戏预设记进 presetWidths。width 为 undefined 时恢复默认。
 *
 * 不进撤销：撤销只记 10 步，拖几下列宽就会把改练度、改计划的记录挤掉
 */
export function setViewColumnWidth(cpp: Cpp<any>, ref: string, id: string, width: number | undefined) {
  const presets = ref.startsWith(PredefinedGameQueryPrefix) ? cpp.gameAdapter.getPredefinedQueries() : undefined
  cpp.store.set(cpp.atoms.atoms.dataAtom, 'modifyWithoutUndo', (draft) => {
    if (ref.startsWith(SavedQueryPrefix)) {
      const saved = draft.savedQueries.find((x) => x.id === ref.slice(SavedQueryPrefix.length))
      if (saved) setQueryWidth(saved.query, id, width)
    } else if (ref === ListModeFav) {
      if (draft.favQuery) setQueryWidth(draft.favQuery, id, width)
    } else if (presets) {
      const key = ref.slice(PredefinedGameQueryPrefix.length)
      if (!presets[key]) return
      const row = presetRowKey(presets, key)
      const widths = withWidth(draft.presetWidths?.[row], id, width)
      if (widths) {
        ;(draft.presetWidths ??= {})[row] = widths
      } else if (draft.presetWidths) {
        delete draft.presetWidths[row]
        if (Object.keys(draft.presetWidths).length === 0) delete draft.presetWidths
      }
    }
  })
}

function setQueryWidth(query: QueryParam, id: string, width: number | undefined) {
  const widths = withWidth(query.widths, id, width)
  if (widths) query.widths = widths
  else delete query.widths
}

function withWidth(widths: QueryParam['widths'], id: string, width: number | undefined) {
  const next = { ...widths }
  if (width == null) delete next[id]
  else next[id] = width
  return Object.keys(next).length > 0 ? next : undefined
}
