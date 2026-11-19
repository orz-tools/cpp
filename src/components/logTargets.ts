import { useSetAtom } from 'jotai'
import { useCpp, useGameAdapter } from '../Cpp'
import { useComponents } from '../hooks/useComponents'
import { useChamber } from './Chamber'
import { ListModeWithGoal, PredefinedGameQueryPrefix } from './characterQuery'
import { dataMenuOpenAtom } from './dataMenu'
import { useQueryEditorToggle } from './queryEditor/QueryEditor'
import { useShowSidebarPanel } from './Sidebar'

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
  const setParam = useSetAtom(useCpp().queryParamAtom)
  const editor = useQueryEditorToggle()
  const setDataMenuOpen = useSetAtom(dataMenuOpenAtom)
  const { add } = useChamber()

  if (target == null) return undefined
  if (target === 'filterEditor') return () => (editor.open ? undefined : editor.toggle())
  if (target === 'dataMenu') return () => setDataMenuOpen(true)
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
