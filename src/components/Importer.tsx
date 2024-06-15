import { Button, Callout, Dialog, DialogFooter, Intent, Menu, Tab, Tabs } from '@blueprintjs/core'
import { useVirtualizer } from '@tanstack/react-virtual'
import deepEqual from 'deep-equal'
import { Draft } from 'immer'
import { useSetAtom } from 'jotai'
import { memo, useMemo, useRef, useState } from 'react'
import useEvent from 'react-use-event-hook'
import { useAtoms, useGameAdapter, useStore } from '../Cpp'
import { useComponents } from '../hooks/useComponents'
import { IGame } from '../pkg/cpp-basic'
import { UserData } from '../pkg/cpp-core/UserData'
import { gt } from '../pkg/gt'
import { useChamber } from './Chamber'
import { renderCharacterStatus } from './CharacterList'
import { ErrAtom } from './Err'
import { CachedImg } from './Icons'
import { ValueTag } from './Value'

export interface ImportContext {
  addWarning(text: string): void
}

export function useStartImportSession() {
  const setErr = useSetAtom(ErrAtom)
  const atoms = useAtoms()
  const store = useStore()
  const { add } = useChamber()

  return <G extends IGame>(generatorGenerator: () => (draft: Draft<UserData<G>>, ctx: ImportContext) => void) => {
    try {
      const generator = generatorGenerator()
      const warnings = [] as string[]
      const ctx: ImportContext = {
        addWarning(text: string) {
          warnings.push(text)
        },
      }
      const before = JSON.parse(JSON.stringify(store.get(atoms.allDataAtom)))
      try {
        store.set(atoms.allDataAtom, (draft) => generator(draft, ctx))
      } catch (e) {
        setErr({ error: e, context: gt.pgettext('error context', '合并导入数据时遇到问题') })
        return
      }
      const after = JSON.parse(JSON.stringify(store.get(atoms.allDataAtom)))
      add(ImportResultDialog, { diff: { before, after, warnings } })
    } catch (e) {
      setErr({ error: e, context: gt.pgettext('error context', '解析导入数据时遇到问题') })
    }
  }
}

interface State {
  before: UserData<any>
  after: UserData<any>
  warnings: string[]
}

const ImportResultDialog = memo(({ diff, onClose }: { diff: State; onClose: () => void }) => {
  const atoms = useAtoms()
  const store = useStore()
  const undoAndClose = useEvent(() => {
    store.set(atoms.dataAtom, 'undo')
    onClose()
  })

  return (
    <Dialog icon={'log-in'} isOpen={true} onClose={onClose} title={gt.gettext('导入结果')}>
      {diff ? (
        <>
          <DiffView diff={diff} />
          <DialogFooter
            actions={
              <Button onClick={onClose} minimal>
                {gt.gettext('关闭')}
              </Button>
            }
          >
            <Button icon="undo" onClick={undoAndClose} minimal>
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

  const detail = useMemo(() => {
    const { before, after } = diff

    const charDiffs = [] as { key: string; before: object; after: object }[]
    {
      const allChars = new Set([...Object.keys(before.current), ...Object.keys(after.current)])
      for (const char of allChars) {
        if (deepEqual(before.current[char], after.current[char])) continue
        charDiffs.push({ key: char, before: before.current[char], after: after.current[char] })
      }
    }

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

    return { charDiffs, inventoryDiffs, inventoryValueDelta }
  }, [diff, ga])

  const [tab, setTab] = useState<string | number>(() => {
    if (detail.inventoryDiffs.length <= 0) return 'char'
    return detail.charDiffs.length > 0 ? 'char' : 'inv'
  })

  return (
    <>
      <div style={{ height: '70vh', display: 'flex', flexDirection: 'column', padding: '15px', rowGap: '15px' }}>
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

const CharDiffView = memo(({ charDiffs }: { charDiffs: { key: string; before: object; after: object }[] }) => {
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

const CharDiffViewRow = memo(
  ({ row, style }: { row: { key: string; before: object; after: object }; style?: React.CSSProperties }) => {
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
        <a role="menuitem" tabIndex={0} className="bp5-menu-item cpp-char-menu-char cpp-menu-not-interactive">
          <>
            <span className="bp5-menu-item-icon cpp-char-avatar">
              <CachedImg
                src={character.avatar}
                width={'100%'}
                height={'100%'}
                alt={character.key}
                title={character.key}
              />
            </span>
            <div className="bp5-fill" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div className="bp5-text-overflow-ellipsis" title={character.name}>
                {character.name}
              </div>
              <div
                className="bp5-text-overflow-ellipsis"
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
          className="bp5-menu-item cpp-char-menu-status cpp-char-menu-status-current cpp-menu-not-interactive"
          style={{ opacity: uda.isAbsentCharacter(character, currentCharacter) ? 0.25 : 1 }}
        >
          {render(currentCharacter, character, goalCharacter, false)}
        </a>
        <a
          role="menuitem"
          tabIndex={0}
          className="bp5-menu-item cpp-char-menu-status cpp-char-menu-status-goal cpp-menu-not-interactive"
          style={{ opacity: uda.isAbsentCharacter(character, goalCharacter) ? 0.25 : 1 }}
        >
          {render(goalCharacter, character, currentCharacter, false)}
        </a>
      </li>
    )
  },
)

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
              <th style={{ width: '10em', textAlign: 'left' }}>{gt.gettext('道具')}</th>
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
    const valueDelta = item.valueAsAp! * (row.after - row.before)
    return (
      <tr role="none" style={style}>
        <td>
          <div style={{ display: 'flex' }}>
            <CachedImg
              className={'cpp-item-icon'}
              src={item.icon}
              width={'20'}
              height={'20'}
              alt={item.key}
              title={item.key}
            />
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
