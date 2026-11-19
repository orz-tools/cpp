import { Button, Callout, Classes, Dialog, DialogFooter, Intent, Menu, Tab, Tabs } from '@blueprintjs/core'
import { useVirtualizer } from '@tanstack/react-virtual'
import deepEqual from 'deep-equal'
import { Draft } from 'immer'
import { useSetAtom } from 'jotai'
import { memo, ReactNode, useRef, useState } from 'react'
import useEvent from 'react-use-event-hook'
import { useAtoms, useGameAdapter, useGameDataMemo, useStore } from '../Cpp'
import { useComponents } from '../hooks/useComponents'
import { IGame } from '../pkg/cpp-basic'
import { UserData } from '../pkg/cpp-core/UserData'
import { gt } from '../pkg/gt'
import { useChamber } from './Chamber'
import { renderCharacterStatus } from './CharacterList'
import { useCppDumpImportFormat } from './CppDumpImport'
import { ErrAtom } from './Err'
import { CachedImg, ItemIcon } from './Icons'
import { StatusDiff, statusDiffs } from './importDiff'
import { showAlert } from './MessageBox'
import { ValueTag } from './Value'

export interface ImportContext {
  /** Something the user has to check or act on; the result dialog lists it under 导入时产生的警告. */
  addWarning(text: string): void
  /** Plain information, such as where the data came from; the result dialog shows it without any alarm. */
  addNote(text: string): void
}

// start() imports what match() already parsed, so nothing is parsed twice. rejected: the format is recognised but
// cannot be imported here, and no later format gets a try.
export type ImportMatch = { start(): void } | { rejected: string }

export interface ImportFormat {
  label: string
  match(text: string): ImportMatch | undefined
}

const noImportFormats = (): ImportFormat[] => []

export function useImportFormats(): ImportFormat[] {
  const cppDump = useCppDumpImportFormat()
  // The game component is fixed per page load, so every render calls the same hooks.
  const { useImportFormats: useGameImportFormats = noImportFormats } = useComponents()
  const game = useGameImportFormats()
  return [cppDump, ...game]
}

/** Imports text in whichever format it turns out to be, or tells the user why it cannot. Returns whether it started. */
export function useImportByContent() {
  const formats = useImportFormats()
  const why = (text: string): ReactNode => {
    if (!text.trim()) return gt.gettext('剪贴板里没有文本或文件。')
    for (const format of formats) {
      const match = format.match(text)
      if (!match) continue
      if ('rejected' in match) return match.rejected
      match.start()
      return undefined
    }
    return (
      <>
        {gt.gettext('无法识别粘贴的内容。支持以下格式：')}
        <ul className={Classes.LIST} style={{ marginBottom: 0 }}>
          {formats.map((x) => (
            <li key={x.label}>{x.label}</li>
          ))}
        </ul>
      </>
    )
  }
  return useEvent((text: string): boolean => {
    const error = why(text)
    if (error) void showAlert(error, { icon: 'warning-sign', intent: 'warning' })
    return !error
  })
}

export function useStartImportSession() {
  const setErr = useSetAtom(ErrAtom)
  const atoms = useAtoms()
  const store = useStore()
  const { add } = useChamber()

  /**
   * source names the format in the result dialog's title. Returns whether the data was written.
   * onUndo runs after the result dialog's 撤销 has taken the user data back, for what the import wrote elsewhere.
   */
  return <G extends IGame>(
    source: string,
    generatorGenerator: () => (draft: Draft<UserData<G>>, ctx: ImportContext) => void,
    options?: { onUndo?: () => void },
  ): boolean => {
    try {
      const generator = generatorGenerator()
      const warnings = [] as string[]
      const notes = [] as string[]
      const ctx: ImportContext = {
        addWarning(text: string) {
          warnings.push(text)
        },
        addNote(text: string) {
          notes.push(text)
        },
      }
      const before = JSON.parse(JSON.stringify(store.get(atoms.allDataAtom)))
      try {
        store.set(atoms.allDataAtom, (draft) => generator(draft, ctx))
      } catch (e) {
        setErr({ error: e, context: gt.pgettext('error context', '合并导入数据时遇到问题') })
        return false
      }
      const after = JSON.parse(JSON.stringify(store.get(atoms.allDataAtom)))
      add(ImportResultDialog, { source, diff: { before, after, warnings, notes }, onUndo: options?.onUndo })
      return true
    } catch (e) {
      setErr({ error: e, context: gt.pgettext('error context', '解析导入数据时遇到问题') })
      return false
    }
  }
}

interface State {
  before: UserData<any>
  after: UserData<any>
  warnings: string[]
  notes: string[]
}

interface ImportResultDialogProps {
  source: string
  diff: State
  onUndo?: () => void
  onClose: () => void
}

const ImportResultDialog = memo(({ source, diff, onUndo, onClose }: ImportResultDialogProps) => {
  const atoms = useAtoms()
  const store = useStore()
  const undoAndClose = useEvent(() => {
    // An import that changed nothing leaves no undo step, so undoing would take back the edit before it.
    if (!deepEqual(diff.before, diff.after)) store.set(atoms.dataAtom, 'undo')
    onUndo?.()
    onClose()
  })

  return (
    <Dialog
      icon={'log-in'}
      isOpen={true}
      onClose={onClose}
      title={gt
        .pgettext('import result title', '导入结果 · %s') /* I10N: %s: format name */
        .replaceAll('%s', source)}
    >
      {diff ? (
        <>
          <DiffView diff={diff} />
          <DialogFooter
            actions={
              <Button onClick={onClose} variant="minimal">
                {gt.gettext('关闭')}
              </Button>
            }
          >
            <Button icon="undo" onClick={undoAndClose} variant="minimal">
              {gt.gettext('撤销')}
            </Button>
          </DialogFooter>
        </>
      ) : null}
    </Dialog>
  )
})

const DiffView = memo(({ diff }: { diff: State }) => {
  const ga = useGameAdapter()

  const detail = useGameDataMemo(() => {
    const { before, after } = diff

    const uda = ga.getUserDataAdapter()
    const empty = uda.getFrozenEmptyCharacterStatus()
    const compared = uda.statusForImportDiff?.bind(uda)
    const charDiffs = statusDiffs(before.current, after.current, empty, compared)
    const goalDiffs = statusDiffs(before.goal, after.goal, empty, compared)

    const inventoryDiffs = [] as { key: string; before: number; after: number }[]
    let inventoryValueDelta = 0
    {
      const allKeys = new Set([...Object.keys(before.items), ...Object.keys(after.items)])
      for (const i of allKeys) {
        const b = before.items[i] || 0
        const a = after.items[i] || 0
        if (a - b === 0) continue
        inventoryDiffs.push({ key: i, before: b, after: a })
        const valueDelta = (a - b) * (ga.getItem(i)?.valueAsAp || 0)
        if (Number.isFinite(valueDelta)) {
          inventoryValueDelta += valueDelta
        }
      }
    }

    return { charDiffs, goalDiffs, inventoryDiffs, inventoryValueDelta }
  }, [diff, ga])

  const [tab, setTab] = useState<string | number>(() => {
    if (detail.charDiffs.length > 0) return 'char'
    if (detail.goalDiffs.length > 0) return 'goal'
    return detail.inventoryDiffs.length > 0 ? 'inv' : 'char'
  })

  return (
    <>
      <div style={{ height: '70vh', display: 'flex', flexDirection: 'column', padding: '15px', rowGap: '15px' }}>
        {diff.notes.length > 0 ? (
          <Callout icon="info-sign">
            <ul style={{ margin: 0, padding: 0 }}>
              {diff.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </Callout>
        ) : null}
        {diff.warnings.length > 0 ? (
          <Callout intent="warning" title={gt.gettext('导入时产生的警告')}>
            <ul style={{ margin: 0, padding: 0 }}>
              {diff.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </Callout>
        ) : null}
        <div className="cpp-importer-diff" style={{ overflow: 'auto', flex: 1 }}>
          <Tabs selectedTabId={tab} vertical onChange={(x) => setTab(x)} fill>
            <Tab
              id={'char'}
              title={gt.gettext('角色')}
              tagContent={detail.charDiffs.length}
              panel={<CharDiffView charDiffs={detail.charDiffs} />}
            />
            <Tab
              id={'goal'}
              title={gt.gettext('目标')}
              tagContent={detail.goalDiffs.length}
              panel={<CharDiffView charDiffs={detail.goalDiffs} />}
            />
            <Tab
              id={'inv'}
              title={gt.gettext('道具')}
              tagContent={detail.inventoryDiffs.length}
              panel={
                <InventoryDiffView
                  inventoryDiffs={detail.inventoryDiffs}
                  inventoryValueDelta={detail.inventoryValueDelta}
                />
              }
            />
          </Tabs>
        </div>
      </div>
    </>
  )
})

const CharDiffView = memo(({ charDiffs }: { charDiffs: StatusDiff<object>[] }) => {
  const list = charDiffs || []
  const parentRef = useRef<HTMLUListElement>(null)
  const components = useComponents()
  const defaultCharStatusWidth = 43 * 6
  const charStatusWidth = components.charStatusWidth || defaultCharStatusWidth

  const rowVirtualizer = useVirtualizer({
    count: list.length,
    getScrollElement: () => parentRef.current,
    getItemKey: (index) => list[index].key,
    overscan: 5,
    estimateSize: () => 50,
  })

  return (
    <>
      <Menu
        style={{
          flex: 1,
          flexShrink: 1,
          overflow: 'auto',
          minWidth: Math.max(730 - defaultCharStatusWidth * 2 + charStatusWidth * 2, 560),
          height: '100%',
        }}
        ulRef={parentRef}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const index = virtualRow.index
            return (
              <CharDiffViewRow
                key={virtualRow.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                row={list[index]}
              />
            )
          })}
        </div>
      </Menu>
    </>
  )
})

const CharDiffViewRow = memo(({ row, style }: { row: StatusDiff<object>; style?: React.CSSProperties }) => {
  const ga = useGameAdapter()
  const uda = ga.getUserDataAdapter()
  const charId = row.key
  const character = ga.getCharacter(charId)
  const currentCharacter = row.before || uda.getFrozenEmptyCharacterStatus()
  const goalCharacter = row.after || uda.getFrozenEmptyCharacterStatus()

  const c = useComponents()
  const render = c.renderCharacterStatus || renderCharacterStatus

  return (
    <li
      role="none"
      className={[
        'cpp-char-menu-master',
        `cpp-char-rarity-${character.rarity}`,
        ...(character.characterViewExtraClass || []),
      ].join(' ')}
      style={style}
    >
      <a role="menuitem" tabIndex={0} className="bp6-menu-item cpp-char-menu-char cpp-menu-not-interactive">
        <>
          <span className="bp6-menu-item-icon cpp-char-avatar">
            <CachedImg
              src={character.avatar}
              width={'100%'}
              height={'100%'}
              alt={character.key}
              title={character.key}
            />
            {c.renderCharacterAvatarBadge && !uda.isAbsentCharacter(character, goalCharacter)
              ? c.renderCharacterAvatarBadge(goalCharacter, character)
              : null}
          </span>
          <div className="bp6-fill" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="bp6-text-overflow-ellipsis" title={character.name}>
              {character.name}
            </div>
            <div
              className="bp6-text-overflow-ellipsis"
              title={character.appellation}
              style={{ fontWeight: 'normal', opacity: 0.75 }}
            >
              {character.appellation}
            </div>
          </div>
        </>
      </a>

      <a
        role="menuitem"
        tabIndex={0}
        className="bp6-menu-item cpp-char-menu-status cpp-char-menu-status-current cpp-menu-not-interactive"
        style={{ opacity: uda.isAbsentCharacter(character, currentCharacter) ? 0.25 : 1 }}
      >
        {render(currentCharacter, character, goalCharacter, false)}
      </a>
      <a
        role="menuitem"
        tabIndex={0}
        className="bp6-menu-item cpp-char-menu-status cpp-char-menu-status-goal cpp-menu-not-interactive"
        style={{ opacity: uda.isAbsentCharacter(character, goalCharacter) ? 0.25 : 1 }}
      >
        {render(goalCharacter, character, currentCharacter, false)}
      </a>
    </li>
  )
})

const InventoryDiffView = memo(
  ({
    inventoryDiffs,
    inventoryValueDelta,
  }: {
    inventoryDiffs: { key: string; before: number; after: number }[]
    inventoryValueDelta: number
  }) => {
    return (
      <div
        style={{
          overflowY: 'auto',
        }}
      >
        <table style={{ width: '100%' }}>
          <thead>
            <tr>
              <td>Σ</td>
              <td></td>
              <td></td>
              <td></td>
              <td
                style={{
                  textAlign: 'right',
                  paddingLeft: '2em',
                }}
              >
                <ValueTag
                  single
                  minimal
                  value={inventoryValueDelta}
                  style={{
                    width: '100%',
                    verticalAlign: 'bottom',
                  }}
                  intent={
                    Number.isFinite(inventoryValueDelta)
                      ? inventoryValueDelta > 0
                        ? Intent.DANGER
                        : inventoryValueDelta < 0
                          ? Intent.SUCCESS
                          : undefined
                      : undefined
                  }
                />
              </td>
            </tr>
            <tr>
              <th style={{ width: '18em', textAlign: 'left' }}>{gt.gettext('道具')}</th>
              <th style={{ width: '5em', textAlign: 'right' }}>{gt.gettext('以往')}</th>
              <th></th>
              <th style={{ width: '5em', textAlign: 'right' }}>{gt.gettext('如今')}</th>
              <th style={{ width: '10em', textAlign: 'right' }}>{gt.gettext('价值变化')}</th>
            </tr>
          </thead>
          <tbody>
            {inventoryDiffs.map((row) => (
              <InventoryDiffViewRow key={row.key} row={row} />
            ))}
          </tbody>
        </table>
      </div>
    )
  },
)

const InventoryDiffViewRow = memo(
  ({ row, style }: { row: { key: string; before: number; after: number }; style?: React.CSSProperties }) => {
    const ga = useGameAdapter()
    const item = ga.getItem(row.key)
    const valueDelta = (item.valueAsAp || 0) * (row.after - row.before)
    return (
      <tr role="none" style={style}>
        <td>
          <div style={{ display: 'flex' }}>
            <ItemIcon item={item} size={20} />
            <span style={{ flex: 1, flexShrink: 1 }}>{item.name}</span>
          </div>
        </td>
        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{row.before}</td>
        <td>➔</td>
        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{row.after}</td>
        <td
          style={{
            textAlign: 'right',
            paddingLeft: '2em',
          }}
        >
          <ValueTag
            single
            minimal
            value={valueDelta}
            style={{
              width: '100%',
              verticalAlign: 'bottom',
            }}
            intent={
              Number.isFinite(valueDelta)
                ? valueDelta > 0
                  ? Intent.DANGER
                  : valueDelta < 0
                    ? Intent.SUCCESS
                    : undefined
                : undefined
            }
          />
        </td>
      </tr>
    )
  },
)
