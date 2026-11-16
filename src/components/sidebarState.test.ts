import { describe, expect, it } from 'vitest'
import {
  activePanelId,
  clickRailItem,
  defaultSidebarState,
  hasUnseenLogs,
  readLogMark,
  readSidebarState,
} from './sidebarState'

describe('readSidebarState', () => {
  it('keeps a well-formed record', () => {
    expect(readSidebarState({ open: false, panel: 'farm' })).toEqual({ open: false, panel: 'farm' })
  })

  it('falls back to the default without a record or with a malformed one', () => {
    expect(readSidebarState(null)).toEqual(defaultSidebarState)
    expect(readSidebarState(undefined)).toEqual(defaultSidebarState)
    expect(readSidebarState('oops')).toEqual(defaultSidebarState)
    expect(readSidebarState({ open: 'yes', panel: 'about' })).toEqual(defaultSidebarState)
    expect(readSidebarState({ open: true })).toEqual(defaultSidebarState)
    expect(readSidebarState({ open: true, panel: 3 })).toEqual(defaultSidebarState)
  })

  it('opens on the about panel by default', () => {
    expect(defaultSidebarState).toEqual({ open: true, panel: 'about' })
  })
})

describe('activePanelId', () => {
  const ids = ['about', 'farm', 'modules']

  it('shows the remembered panel while it is available', () => {
    expect(activePanelId({ open: true, panel: 'modules' }, ids)).toBe('modules')
  })

  it('shows the first panel when the remembered one is not available', () => {
    expect(activePanelId({ open: true, panel: 'nope' }, ids)).toBe('about')
  })
})

describe('clickRailItem', () => {
  it('opens on the clicked panel while collapsed', () => {
    expect(clickRailItem({ open: false, panel: 'about' }, 'about', 'farm')).toEqual({ open: true, panel: 'farm' })
    expect(clickRailItem({ open: false, panel: 'about' }, 'about', 'about')).toEqual({ open: true, panel: 'about' })
  })

  it('switches to another panel while open', () => {
    expect(clickRailItem({ open: true, panel: 'about' }, 'about', 'farm')).toEqual({ open: true, panel: 'farm' })
  })

  it('collapses when the shown panel is clicked', () => {
    expect(clickRailItem({ open: true, panel: 'farm' }, 'farm', 'farm')).toEqual({ open: false, panel: 'farm' })
  })

  it('treats the fallback panel as the shown one', () => {
    expect(clickRailItem({ open: true, panel: 'nope' }, 'about', 'about')).toEqual({ open: false, panel: 'about' })
  })
})

describe('readLogMark', () => {
  it('keeps a well-formed record', () => {
    expect(readLogMark({ date: '2026-05-01', count: 2 })).toEqual({ date: '2026-05-01', count: 2 })
  })

  it('reads a malformed record as none', () => {
    expect(readLogMark(null)).toBeNull()
    expect(readLogMark('2026-05-01')).toBeNull()
    expect(readLogMark({ date: '2026-05-01' })).toBeNull()
    expect(readLogMark({ date: 20260501, count: 1 })).toBeNull()
    expect(readLogMark({ date: '2026-05-01', count: '1' })).toBeNull()
  })
})

describe('hasUnseenLogs', () => {
  const latest = { date: '2026-05-01', count: 2 }

  it('is off without a record', () => {
    expect(hasUnseenLogs(latest, null)).toBe(false)
  })

  it('is off for a malformed record', () => {
    expect(hasUnseenLogs(latest, readLogMark({ date: 1, count: 1 }))).toBe(false)
  })

  it('is off without any changelog entry', () => {
    expect(hasUnseenLogs(undefined, { date: '2026-05-01', count: 2 })).toBe(false)
  })

  it('is on for a newer date', () => {
    expect(hasUnseenLogs(latest, { date: '2024-10-15', count: 5 })).toBe(true)
  })

  it('is on for more entries on the same date', () => {
    expect(hasUnseenLogs(latest, { date: '2026-05-01', count: 1 })).toBe(true)
  })

  it('is off for the same date and count', () => {
    expect(hasUnseenLogs(latest, { date: '2026-05-01', count: 2 })).toBe(false)
  })

  it('is off when the record is newer', () => {
    expect(hasUnseenLogs(latest, { date: '2027-01-01', count: 1 })).toBe(false)
  })
})
