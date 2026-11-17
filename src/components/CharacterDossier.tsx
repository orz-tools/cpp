import { Button, Drawer, Popover } from '@blueprintjs/core'
import { useAtomValue } from 'jotai'
import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react'
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

/** 目录高亮的节：顶边不低于滚动区顶边 + 8px 的最后一节；滚到底时是最后一节 */
function currentSection(body: HTMLElement): string | undefined {
  const els = [...body.querySelectorAll<HTMLElement>('[data-dossier-section]')]
  if (els.length === 0) return undefined
  if (body.scrollTop + body.clientHeight >= body.scrollHeight - 1) return els[els.length - 1].dataset.dossierSection
  const top = body.getBoundingClientRect().top + 8
  let current = els[0].dataset.dossierSection
  for (const el of els) if (el.getBoundingClientRect().top <= top) current = el.dataset.dossierSection
  return current
}

const DossierSections = memo(({ character, sections }: { character: ICharacter; sections: DossierSection[] }) => {
  const bodyRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState<string | undefined>(sections[0]?.id)
  const ids = sections.map((s) => s.id).join(' ')

  useEffect(() => {
    const body = bodyRef.current
    if (!body) return
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        setActive(currentSection(body))
      })
    }
    body.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      body.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [ids])

  // 换干员时回到第一节
  useLayoutEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0
    setActive(undefined)
  }, [character.key])

  const jump = (id: string) => {
    const el = bodyRef.current?.querySelector(`[data-dossier-section="${CSS.escape(id)}"]`)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' })
  }
  const current = active && sections.some((s) => s.id === active) ? active : sections[0]?.id

  return (
    <>
      {sections.length >= 2 ? (
        <nav className="cpp-dossier-toc" aria-label={gt.pgettext('character dossier', '目录')}>
          {sections.map(({ id, title }) => (
            <Button
              key={id}
              variant="minimal"
              size="small"
              text={title.toString()}
              active={id === current}
              intent={id === current ? 'primary' : undefined}
              aria-current={id === current ? 'location' : undefined}
              onClick={() => jump(id)}
            />
          ))}
        </nav>
      ) : null}
      <div className="cpp-dossier-body" ref={bodyRef}>
        {sections.map(({ id, title, Body }) => (
          <section key={id} className="cpp-dossier-section" data-dossier-section={id}>
            <h5 className="cpp-dossier-section-title">{title.toString()}</h5>
            <Body key={character.key} character={character} />
          </section>
        ))}
      </div>
    </>
  )
})

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
        <DossierSections character={character} sections={sections} />
      </div>
    </Drawer>
  )
})
