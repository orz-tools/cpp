import { useSetAtom } from 'jotai'
import { useCpp, useGameAdapter } from '../Cpp'
import { useComponents } from '../hooks/useComponents'
import { useChamber } from './Chamber'
import { ListModeWithGoal, PredefinedGameQueryPrefix } from './characterQuery'
import { dataMenuOpenAtom } from './dataMenu'
import { useQueryEditorToggle } from './queryEditor/QueryEditor'
import { phoneAreaAtom, usePhoneLayout } from './phoneLayout'
import { useShowPhoneMoreList, useShowSidebarPanel } from './Sidebar'

/** Where a changelog line leads when clicked */
export type LogTarget =
  /** A sidebar panel, by its id */
  | { panel: string }
  /** A 「更多视图」 preset, by its key */
  | { view: string }
  | 'filterEditor'
  /** The 计划 view of the character list */
  | 'planView'
  | 'dataMenu'
  | 'valueSettings'

/** What clicking the line does, or undefined when this game has no such place (yet) */
export function useLogTarget(target: LogTarget | undefined): (() => void) | undefined {
  const ga = useGameAdapter()
  const { sidebarPanels, ValueConfigDialog } = useComponents()
  const showPanel = useShowSidebarPanel()
  const setQueryParam = useSetAtom(useCpp().queryParamAtom)
  const editor = useQueryEditorToggle()
  const setDataMenuOpen = useSetAtom(dataMenuOpenAtom)
  const { add } = useChamber()
  // 手机上更新笔记在「更多」里：指向干员列表的那几条要切过去才看得到，「导入/导出」在「更多」的列表里
  const phone = usePhoneLayout()
  const setPhoneArea = useSetAtom(phoneAreaAtom)
  const showPhoneMoreList = useShowPhoneMoreList()
  const toList = phone ? () => setPhoneArea('chars') : () => {}
  const setParam: typeof setQueryParam = (update) => {
    setQueryParam(update)
    toList()
  }

  if (target == null) return undefined
  if (target === 'filterEditor')
    return () => {
      if (!editor.open) editor.toggle()
      toList()
    }
  if (target === 'dataMenu') return phone ? showPhoneMoreList : () => setDataMenuOpen(true)
  if (target === 'planView') return () => setParam((x) => ({ ...x, query: ListModeWithGoal, source: undefined }))
  if (target === 'valueSettings') {
    return ValueConfigDialog ? () => add(ValueConfigDialog, {}, 'valueSettings') : undefined
  }
  if ('panel' in target) {
    const panel = sidebarPanels?.find((p) => p.id === target.panel)
    return panel && (!panel.isAvailable || panel.isAvailable(ga)) ? () => showPanel(panel.id) : undefined
  }
  // The base skill presets appear only once the game data carries base skills
  if (!Object.hasOwn(ga.getPredefinedQueries(), target.view)) return undefined
  return () => setParam((x) => ({ ...x, query: PredefinedGameQueryPrefix + target.view, source: undefined }))
}
