import { Button, Drawer, Popover } from '@blueprintjs/core'
import { useAtomValue } from 'jotai'
import { memo, useEffect, useRef, useState } from 'react'
import useEvent from 'react-use-event-hook'
import { useGameAdapter, useGameDataMemo } from '../Cpp'
import { useComponents } from '../hooks/useComponents'
import { ICharacter } from '../pkg/cpp-basic'
import { gt, lpstr } from '../pkg/gt'
import { CharacterContextMenu } from './CharacterList'
import { CharacterStatusPopover } from './CharacterStatusPopover'
import { CachedImg } from './Icons'
import { dossierAtom, useCloseCharacterDossier } from './dossierHooks'
import { DossierState, visibleSections } from './dossierState'
import { DossierSection } from './types'

const StatusSectionBody = memo(({ character }: { character: ICharacter }) => {
  const CSP = useComponents().CharacterStatusPopover || CharacterStatusPopover
  return (
    <>
      <div className="cpp-dossier-editor">
        <CSP character={character} isGoal={false} embedded />
      </div>
      <div className="cpp-dossier-editor-sep" />
      <div className="cpp-dossier-editor">
        <CSP character={character} isGoal={true} embedded />
      </div>
    </>
  )
})

export const statusSection: DossierSection = {
  id: 'status',
  title: lpstr(() => gt.pgettext('dossier section', '练度')),
  Body: StatusSectionBody,
}

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
          <Popover content={<CharacterContextMenu character={character} />} placement="bottom-end" minimal>
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
        <div className="cpp-dossier-body">
          {sections.map(({ id, title, Body }) => (
            <section key={id} className="cpp-dossier-section" data-dossier-section={id}>
              <h5 className="cpp-dossier-section-title">{title.toString()}</h5>
              <Body key={character.key} character={character} />
            </section>
          ))}
        </div>
      </div>
    </Drawer>
  )
})
