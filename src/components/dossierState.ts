export interface DossierState {
  charId: string
  /** Drawer 的 key；加一时档案重新打开，排到所有已打开的窗口后面 */
  generation: number
  /** 档案上一次打开（或重新打开）时，已经打开过多少个窗口 */
  epoch: number
}

/**
 * 点干员以后的状态。窗口外点时，epoch 是当前的窗口计数；窗口里点时，是这个窗口的序号。
 */
export function clickCharacter(
  state: DossierState | null,
  charId: string,
  at: { epoch: number; inWindow: boolean },
): DossierState | null {
  if (!state) return { charId, generation: 0, epoch: at.epoch }
  // 档案比这个窗口先打开，被盖在下面：重新打开，Blueprint 才把它排到窗口上面、让焦点进来
  if (at.inWindow && state.epoch < at.epoch) return { charId, generation: state.generation + 1, epoch: at.epoch }
  if (state.charId === charId) return null
  return { ...state, charId }
}

/** 和 clickCharacter 不同，档案已经开着这名干员时不关上：从侧栏点一件时装，是要看这名干员的档案 */
export function showCharacter(
  state: DossierState | null,
  charId: string,
  at: { epoch: number; inWindow: boolean },
): DossierState {
  if (!state) return { charId, generation: 0, epoch: at.epoch }
  if (at.inWindow && state.epoch < at.epoch) return { charId, generation: state.generation + 1, epoch: at.epoch }
  if (state.charId === charId) return state
  return { ...state, charId }
}

export function visibleSections<S>(sections: readonly S[], isAvailable: (s: S) => boolean): S[] {
  return sections.filter(isAvailable)
}

export type StatusMode = 'current' | 'goal'

export interface DossierPrefs {
  /** 选中的页签，是 DossierSection 的 id；这名干员没有这一页时显示第一页，记录不改 */
  section: string
  /** 「练度」页显示哪一边 */
  statusMode: StatusMode
}

export const defaultDossierPrefs: DossierPrefs = { section: 'status', statusMode: 'goal' }

/** 一个字段坏了只换这一个字段 */
export function readDossierPrefs(stored: unknown): DossierPrefs {
  if (typeof stored !== 'object' || stored == null || Array.isArray(stored)) return defaultDossierPrefs
  const { section, statusMode } = stored as Partial<Record<keyof DossierPrefs, unknown>>
  return {
    section: typeof section === 'string' && section !== '' ? section : defaultDossierPrefs.section,
    statusMode: statusMode === 'current' || statusMode === 'goal' ? statusMode : defaultDossierPrefs.statusMode,
  }
}

/** 记住的页这名干员没有时显示第一页，也就是外壳的「练度」 */
export function shownSection(section: string, availableIds: readonly string[]): string {
  return availableIds.includes(section) ? section : availableIds[0]
}
