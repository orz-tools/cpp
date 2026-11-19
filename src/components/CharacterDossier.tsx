import { Button, Classes, Drawer, Menu, Popover, Tab, Tabs, Tag } from '@blueprintjs/core'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { RefObject, memo, useEffect, useLayoutEffect, useRef, useState } from 'react'
import useEvent from 'react-use-event-hook'
import { useGameAdapter, useGameDataMemo } from '../Cpp'
import { useComponents } from '../hooks/useComponents'
import { ICharacter } from '../pkg/cpp-basic'
import { gt, lpstr } from '../pkg/gt'
import { CharacterLookupMenuItems } from './CharacterList'
import { CharacterStatusPopover } from './CharacterStatusPopover'
import { CachedImg } from './Icons'
import { dossierAtom, dossierPrefsAtom, useCloseCharacterDossier } from './dossierHooks'
import { DossierState, shownSection, visibleSections } from './dossierState'
import { DossierSection } from './types'

const StatusSectionBody = memo(({ character }: { character: ICharacter }) => {
  const CSP = useComponents().CharacterStatusPopover || CharacterStatusPopover
  const [prefs, setPrefs] = useAtom(dossierPrefsAtom)
  const onModeChange = useEvent((isGoal: boolean) =>
    setPrefs((p) => ({ ...p, statusMode: isGoal ? 'goal' : 'current' })),
  )
  // Keyed by the mode, so an open (i) panel or a half-typed level stays with the side it was opened on
  return (
    <CSP
      key={prefs.statusMode}
      character={character}
      isGoal={prefs.statusMode === 'goal'}
      embedded
      onModeChange={onModeChange}
    />
  )
})

export const statusSection: DossierSection = {
  id: 'status',
  title: lpstr(() => gt.pgettext('dossier section', '练度')),
  Body: StatusSectionBody,
}

const noTag = () => null

/** Blueprint's own tagContent draws an empty Tag for a hook that returns null, so the tag is drawn here */
const DossierTabTitle = ({
  section,
  character,
  selected,
}: {
  section: DossierSection
  character: ICharacter
  selected: boolean
}) => {
  // Fixed for as long as the tab exists, so the hooks keep their order
  const useTag = section.useTag ?? noTag
  const tag = useTag(character)
  return (
    <>
      {section.title.toString()}
      {tag != null ? (
        <Tag minimal round intent={selected ? 'primary' : 'none'} className={Classes.TAB_TAG}>
          {tag}
        </Tag>
      ) : null}
    </>
  )
}

/** The 练度 page lets the editor's bars run to the drawer's edges */
const pageClassName = (id: string) => 'cpp-dossier-body' + (id === statusSection.id ? ' cpp-dossier-body-flush' : '')

const DossierTabs = memo(
  ({
    character,
    sections,
    frameRef,
  }: {
    character: ICharacter
    sections: DossierSection[]
    frameRef: RefObject<HTMLDivElement>
  }) => {
    const { section } = useAtomValue(dossierPrefsAtom)
    const setPrefs = useSetAtom(dossierPrefsAtom)
    const shown = shownSection(
      section,
      sections.map((s) => s.id),
    )

    // A new page, or a new character on the same page, starts at the top. useFocusFrame scrolls to the entry it
    // frames in a plain effect, which runs after this one
    useLayoutEffect(() => {
      const frame = frameRef.current
      const body = frame?.querySelector('.cpp-dossier-body')
      if (body) body.scrollTop = 0
      // Only the tab list scrolls: scrollIntoView would also scroll the drawer's ancestors while it slides in
      const tab = frame?.querySelector<HTMLElement>('.cpp-dossier-tabs [role="tab"][aria-selected="true"]')
      const list = tab?.parentElement
      if (!tab || !list) return
      const pad = parseFloat(getComputedStyle(list).paddingLeft) || 0
      const left = tab.offsetLeft - pad
      const right = tab.offsetLeft + tab.offsetWidth + pad - list.clientWidth
      if (list.scrollLeft > left) list.scrollLeft = left
      else if (list.scrollLeft < right) list.scrollLeft = right
    }, [character.key, shown, frameRef])

    if (sections.length < 2) {
      const page = sections[0]
      if (!page) return null
      return (
        <div className={pageClassName(page.id)}>
          <page.Body key={character.key} character={character} />
        </div>
      )
    }

    return (
      <Tabs
        id="cpp-dossier-tabs"
        className="cpp-dossier-tabs"
        selectedTabId={shown}
        onChange={(id) => setPrefs((p) => ({ ...p, section: String(id) }))}
        animate={false}
        renderActiveTabPanelOnly
      >
        {sections.map((s) => (
          <Tab
            key={s.id}
            id={s.id}
            title={<DossierTabTitle section={s} character={character} selected={s.id === shown} />}
            panel={<s.Body key={character.key} character={character} />}
            panelClassName={pageClassName(s.id)}
          />
        ))}
      </Tabs>
    )
  },
)

export const CharacterDossier = memo(() => {
  const state = useAtomValue(dossierAtom)
  const close = useCloseCharacterDossier()
  // The drawer keeps drawing the last character while it slides out
  const [last, setLast] = useState<DossierState | null>(null)
  if (state && state !== last) setLast(state)
  const shown = state ?? last
  // Once it has slid out, the drawer unmounts: Blueprint stacks overlays in the order their portals were first
  // created, so a drawer reused after a window opened would reopen underneath that window
  const onClosed = useEvent(() => {
    if (!state) setLast(null)
  })
  // Blueprint would focus a trap element beside the drawer, outside the frame that carries the dialog role
  const frameRef = useRef<HTMLDivElement>(null)
  const onOpening = useEvent(() => frameRef.current?.focus({ preventScroll: true }))

  const ga = useGameAdapter()
  const { CharacterDossierMeta, dossierSections } = useComponents()
  const charId = shown?.charId
  const character = useGameDataMemo(() => (charId ? ga.getCharacter(charId) : undefined), [ga, charId])
  const missing = state != null && !character
  useEffect(() => {
    // Newer game data no longer has this character
    if (missing) close()
  }, [missing, close])

  if (!shown || !character) return null

  const sections = visibleSections(
    [statusSection, ...(dossierSections ?? [])],
    (s) => !s.isAvailable || s.isAvailable(ga, character),
  )

  return (
    <Drawer
      key={shown.generation}
      isOpen={state != null}
      onClose={close}
      onOpening={onOpening}
      onClosed={onClosed}
      position="right"
      size="min(480px, 100vw)"
      className="cpp-dossier"
      hasBackdrop={false}
      enforceFocus={false}
      canOutsideClickClose={false}
    >
      {/* Blueprint's Drawer carries no role and passes no aria props through */}
      <div
        ref={frameRef}
        className="cpp-dossier-frame"
        tabIndex={-1}
        role="dialog"
        aria-label={gt
          .pgettext('character dossier', '%s 的档案') /* I10N: %s: character name */
          .replaceAll('%s', character.name)}
      >
        <div className="cpp-dossier-header">
          <span
            className={[
              'cpp-dossier-avatar',
              `cpp-char-rarity-${character.rarity}`,
              ...(character.characterViewExtraClass || []),
            ].join(' ')}
          >
            <span className="cpp-char-avatar">
              <CachedImg src={character.avatar} width={48} height={48} alt={character.key} title={character.key} />
            </span>
          </span>
          <div className="cpp-dossier-heading">
            <div className="cpp-dossier-name" title={character.name}>
              {character.name}
            </div>
            <div className="cpp-dossier-meta">
              {character.appellation}
              {CharacterDossierMeta ? (
                <>
                  {' · '}
                  <CharacterDossierMeta character={character} />
                </>
              ) : null}
            </div>
          </div>
          {/* Not the list's context menu: the dossier is in no list to sort, and the 练度 page has its own 拉满 and 清空 */}
          <Popover
            content={
              <Menu>
                <CharacterLookupMenuItems character={character} />
              </Menu>
            }
            placement="bottom-end"
            minimal
          >
            <Button variant="minimal" icon="more" title={gt.gettext('更多')} aria-label={gt.gettext('更多')} />
          </Popover>
          <Button
            variant="minimal"
            icon="cross"
            title={gt.gettext('关闭')}
            aria-label={gt.gettext('关闭')}
            onClick={close}
          />
        </div>
        <DossierTabs character={character} sections={sections} frameRef={frameRef} />
      </div>
    </Drawer>
  )
})
