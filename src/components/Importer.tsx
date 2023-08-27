import { Button, Callout, Dialog, DialogFooter, Menu, Tab, Tabs } from '@blueprintjs/core'
import { useVirtualizer } from '@tanstack/react-virtual'
import deepEqual from 'deep-equal'
import { Draft } from 'immer'
import { atom, useAtomValue, useSetAtom } from 'jotai'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import useEvent from 'react-use-event-hook'
import { useAtoms, useGameAdapter, useStore } from '../Cpp'
import { useComponents } from '../hooks/useComponents'
import { IGame } from '../pkg/cpp-basic'
import { UserData } from '../pkg/cpp-core/UserData'
import { renderCharacterStatus } from './CharacterList'
import { ErrAtom } from './Err'
import { CachedImg } from './Icons'

const importSessionAtom = atom<null | ((current: Draft<UserData<any>>) => void)>(null)

export interface ImportContext {
  addWarning(text: string): void
}

export function useStartImportSession() {
  const setImportSession = useSetAtom(importSessionAtom)
  const setErr = useSetAtom(ErrAtom)

  return <G extends IGame>(generatorGenerator: () => (draft: Draft<UserData<G>>, ctx: ImportContext) => void) => {
    try {
      const generator = generatorGenerator()
      setImportSession(() => generator)
    } catch (e) {
      setErr({ error: e, context: '解析导入数据时遇到问题' })
    }
  }
}

interface State {
  before: UserData<any>
  after: UserData<any>
  warnings: string[]
}

export const Importer = memo(() => {
  const importSession = useAtomValue(importSessionAtom)
  const [diff, setDiff] = useState<State | null>(null)
  const setErr = useSetAtom(ErrAtom)
  const atoms = useAtoms()
  const store = useStore()

  const close = useEvent(() => setDiff(null))
  const undoAndClose = useEvent(() => {
    store.set(atoms.dataAtom, 'undo')
    setDiff(null)
  })

  const work = useEvent((generator: (current: Draft<UserData<any>>, ctx: ImportContext) => void) => {
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
      setErr({ error: e, context: '合并导入数据时遇到问题' })
      return
    }
    const after = JSON.parse(JSON.stringify(store.get(atoms.allDataAtom)))
    setDiff({ before, after, warnings })
  })

  useEffect(() => {
    if (!importSession) return
    work(importSession)
  }, [importSession, work])
  return (
    <>
      <Dialog icon={'log-in'} isOpen={diff !== null} onClose={close} title="导入结果">
        {diff ? (
          <>
            <DiffView diff={diff} />
            <DialogFooter
              actions={
                <Button onClick={close} minimal>
                  中
                </Button>
              }
            >
              <Button icon="undo" onClick={undoAndClose} minimal>
                撤销
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </Dialog>
    </>
  )
})

const DiffView = memo(({ diff }: { diff: State }) => {
  const [tab, setTab] = useState<string | number>('char')
  const detail = useMemo(() => {
    const charDiffs = [] as { key: string; before: object; after: object }[]
    const { before, after } = diff
    const allChars = new Set([...Object.keys(before.current), ...Object.keys(after.current)])
    for (const char of allChars) {
      if (deepEqual(before.current[char], after.current[char])) continue
      charDiffs.push({ key: char, before: before.current[char], after: after.current[char] })
    }

    return { charDiffs }
  }, [diff])

  return (
    <>
      <div style={{ height: '70vh', display: 'flex', flexDirection: 'column', padding: '15px', rowGap: '15px' }}>
        {diff.warnings.length > 0 ? (
          <Callout intent="warning" title="导入时产生的警告">
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
              title={'角色'}
              tagContent={detail.charDiffs.length}
              panel={<CharDiffView charDiffs={detail.charDiffs} />}
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
