export interface SidebarState {
  open: boolean
  panel: string
}

export const defaultSidebarState: SidebarState = { open: true, panel: 'about' }

export function readSidebarState(stored: unknown): SidebarState {
  if (typeof stored !== 'object' || stored == null) return defaultSidebarState
  const { open, panel } = stored as Partial<Record<keyof SidebarState, unknown>>
  if (typeof open !== 'boolean' || typeof panel !== 'string') return defaultSidebarState
  return { open, panel }
}

export function activePanelId(state: SidebarState, panelIds: readonly string[]): string {
  return panelIds.includes(state.panel) ? state.panel : panelIds[0]
}

export function clickRailItem(state: SidebarState, activeId: string, clickedId: string): SidebarState {
  return { open: !(state.open && clickedId === activeId), panel: clickedId }
}

/** The newest changelog date and how many entries it has */
export interface LogMark {
  date: string
  count: number
}

export function readLogMark(stored: unknown): LogMark | null {
  if (typeof stored !== 'object' || stored == null) return null
  const { date, count } = stored as Partial<Record<keyof LogMark, unknown>>
  if (typeof date !== 'string' || typeof count !== 'number') return null
  return { date, count }
}

export function hasUnseenLogs(latest: LogMark | undefined, seen: LogMark | null): boolean {
  if (!latest || !seen) return false
  // YYYY-MM-DD sorts as a string
  if (latest.date !== seen.date) return latest.date > seen.date
  return latest.count > seen.count
}
