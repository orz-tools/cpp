import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import type { SetStateAction } from 'react'
import type { RosterOrder } from './layout'

export interface RosterImagePrefs {
  columns: number
  order: RosterOrder
  goal: boolean
  header: string
}

export const MIN_COLUMNS = 1
export const MAX_COLUMNS = 6
export const MAX_HEADER_LENGTH = 40

export const defaultRosterImagePrefs: RosterImagePrefs = { columns: 1, order: 'rows', goal: false, header: '' }

/** 按码点截，不切开代理对 */
export function clampHeader(header: string): string {
  const chars = [...header]
  return chars.length > MAX_HEADER_LENGTH ? chars.slice(0, MAX_HEADER_LENGTH).join('') : header
}

export function clampColumns(columns: number): number {
  return Math.min(MAX_COLUMNS, Math.max(MIN_COLUMNS, Math.round(columns)))
}

export function readRosterImagePrefs(stored: unknown): RosterImagePrefs {
  if (typeof stored !== 'object' || stored == null || Array.isArray(stored)) return defaultRosterImagePrefs
  const { columns, order, goal, header } = stored as Partial<Record<keyof RosterImagePrefs, unknown>>
  return {
    columns:
      typeof columns === 'number' && Number.isFinite(columns) ? clampColumns(columns) : defaultRosterImagePrefs.columns,
    order: order === 'rows' || order === 'columns' ? order : defaultRosterImagePrefs.order,
    goal: typeof goal === 'boolean' ? goal : defaultRosterImagePrefs.goal,
    header: typeof header === 'string' ? clampHeader(header) : defaultRosterImagePrefs.header,
  }
}

// 和 cpp_sidebar、cpp_dossier 一样记在本机、不分档案；页脚开关不记，每次打开都是开
const rosterImagePrefsStorageAtom = atomWithStorage<unknown>('cpp_roster_image', null, undefined, {
  getOnInit: true,
})

export const rosterImagePrefsAtom = atom(
  (get) => readRosterImagePrefs(get(rosterImagePrefsStorageAtom)),
  (get, set, update: SetStateAction<RosterImagePrefs>) =>
    set(
      rosterImagePrefsStorageAtom,
      typeof update === 'function' ? update(readRosterImagePrefs(get(rosterImagePrefsStorageAtom))) : update,
    ),
)
