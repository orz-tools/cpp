import { Button, Classes, Intent, Tag } from '@blueprintjs/core'
import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai'
import React, { memo, useLayoutEffect, useMemo, useRef, useState } from 'react'
import useEvent from 'react-use-event-hook'
import { useAtoms, useGameAdapter, useGameDataMemo } from '../../Cpp'
import {
  Arknights,
  ArknightsAdapter,
  RECRUIT_TAG_LIMIT,
  RecruitCombo,
  RecruitData,
  RecruitTagGroupName,
  recruitCombos,
  recruitTagGroups,
} from '../../pkg/cpp-arknights'
import { PSTR, gt, lpstr } from '../../pkg/gt'
import { useQuickFilterSet } from '../CharacterList'
import { CachedImg } from '../Icons'
import { useOpenCharacterDossier } from '../dossierHooks'
import { phoneAreaAtom, usePhoneLayout } from '../phoneLayout'
import { SidebarPanel } from '../types'
import { renderCharacterAvatarBadge } from './renderCharacterStatus'

/** 侧栏面板的 id，记在 cpp_sidebar 里，发布之后不能改 */
export const RECRUIT_PANEL = 'recruit'

/** 选中的词条，按选的先后；跟着档案的 store 走，不存 */
export const recruitTagsAtom = atom<number[]>([])

const groupNames: Record<RecruitTagGroupName, PSTR> = {
  qualification: lpstr(() => gt.pgettext('recruit tag group', '资历')),
  profession: lpstr(() => gt.pgettext('recruit tag group', '职业')),
  position: lpstr(() => gt.pgettext('recruit tag group', '位置')),
  ability: lpstr(() => gt.pgettext('recruit tag group', '能力')),
}

const guaranteeIntents: Partial<Record<number, Intent>> = { 6: 'danger', 5: 'warning', 4: 'primary', 3: 'success' }

// 和 style.css 里 .cpp-recruit-avatar 的宽度、.cpp-recruit-avatars 的间距一致
const AVATAR_SIZE = 32
const AVATAR_GAP = 4

function useArknights() {
  return useGameAdapter<Arknights>() as ArknightsAdapter
}

/** 本服的公招数据，数据提交后跟着换 */
export function useRecruit(): RecruitData {
  const dm = useArknights().getDataManager()
  return useGameDataMemo(() => dm.recruit, [dm])
}

export function useRecruitTagNames(recruit: RecruitData): Map<number, string> {
  return useMemo(() => new Map(recruit.tags.map((x) => [x.tagId, x.tagName])), [recruit])
}

const RecruitToolbar = memo(() => {
  const [selected, setSelected] = useAtom(recruitTagsAtom)
  return (
    <Button
      variant="minimal"
      size="small"
      text={gt.pgettext('recruit', '清除')}
      disabled={selected.length === 0}
      onClick={() => setSelected([])}
    />
  )
})

const TagPicker = memo(({ recruit, names }: { recruit: RecruitData; names: Map<number, string> }) => {
  const [selected, setSelected] = useAtom(recruitTagsAtom)
  const full = selected.length >= RECRUIT_TAG_LIMIT
  const toggle = (id: number) =>
    setSelected((x) => (x.includes(id) ? x.filter((y) => y !== id) : x.length >= RECRUIT_TAG_LIMIT ? x : [...x, id]))
  return (
    <div className="cpp-recruit-picker">
      {recruitTagGroups(recruit.tags).map(({ group, tags }) => (
        <div key={group} className="cpp-recruit-group">
          <span className={'cpp-recruit-group-name ' + Classes.TEXT_MUTED}>{groupNames[group].toString()}</span>
          <span className="cpp-recruit-group-tags">
            {tags.map((id) => {
              const on = selected.includes(id)
              return (
                <Button
                  key={id}
                  size="small"
                  intent={on ? 'primary' : undefined}
                  aria-pressed={on}
                  disabled={!on && full}
                  text={names.get(id)}
                  onClick={() => toggle(id)}
                />
              )
            })}
          </span>
        </div>
      ))}
    </div>
  )
})

/** 头像区一行放得下几个；还没量出来时是 0 */
function usePerLine(ref: React.RefObject<HTMLElement | null>) {
  const [perLine, setPerLine] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setPerLine(Math.floor((el.clientWidth + AVATAR_GAP) / (AVATAR_SIZE + AVATAR_GAP)))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return perLine
}

const RecruitAvatar = memo(({ charId }: { charId: string }) => {
  const ga = useArknights()
  const atoms = useAtoms<Arknights>()
  const current = useAtomValue(atoms.currentCharacter(charId))
  const openDossier = useOpenCharacterDossier()
  const character = ga.getCharacter(charId)
  const absent = ga.getUserDataAdapter().isAbsentCharacter(character, current)
  return (
    <button
      type="button"
      className={'cpp-recruit-avatar' + (absent ? ' is-absent' : '')}
      title={character.name}
      aria-label={character.name}
      onClick={() => openDossier(charId)}
    >
      <CachedImg src={character.avatar} width={AVATAR_SIZE} height={AVATAR_SIZE} alt={character.key} />
      {absent ? null : renderCharacterAvatarBadge(current)}
    </button>
  )
})

const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x))

const ComboBlock = memo(
  ({
    combo,
    names,
    expanded,
    onExpand,
  }: {
    combo: RecruitCombo
    names: Map<number, string>
    expanded: boolean
    onExpand: (key: string) => void
  }) => {
    const filter = useQuickFilterSet('recruit')
    const phone = usePhoneLayout()
    const setArea = useSetAtom(phoneAreaAtom)
    const ids = combo.tags.map(String)
    const active = sameSet(filter.values, ids)
    const toggle = () => {
      if (active) {
        filter.clear()
        return
      }
      filter.set(ids)
      // 手机上列表和面板不在同一屏
      if (phone) setArea('chars')
    }

    const avatars = useRef<HTMLDivElement>(null)
    const perLine = usePerLine(avatars)
    const n = combo.charIds.length
    const fold = !expanded && perLine > 0 && n > 2 * perLine
    const shown = fold ? combo.charIds.slice(0, 2 * perLine - 1) : combo.charIds

    return (
      <div className={'cpp-recruit-combo' + (active ? ' is-active' : '')}>
        <div
          role="button"
          tabIndex={0}
          aria-pressed={active}
          className="cpp-recruit-combo-head"
          onClick={toggle}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return
            e.preventDefault()
            toggle()
          }}
        >
          {combo.tags.map((id) => (
            <Tag key={id} minimal>
              {names.get(id) ?? id}
            </Tag>
          ))}
          <span className={'cpp-recruit-count ' + Classes.TEXT_MUTED}>
            {gt
              .ngettext('%d 名', '%d 名', n) /* I10N: %d: number of operators */
              .replaceAll('%d', String(n))}
          </span>
          <Tag intent={guaranteeIntents[combo.guarantee]} className="cpp-recruit-guarantee">
            {gt.pgettext('recruit', '%d★').replaceAll('%d', String(combo.guarantee))}
          </Tag>
        </div>
        <div ref={avatars} className="cpp-recruit-avatars">
          {shown.map((charId) => (
            <RecruitAvatar key={charId} charId={charId} />
          ))}
          {fold ? (
            <button type="button" className="cpp-recruit-more" onClick={() => onExpand(combo.tags.join())}>
              {gt.pgettext('recruit', '+%d').replaceAll('%d', String(n - shown.length))}
            </button>
          ) : null}
        </div>
      </div>
    )
  },
)

const RecruitBody = memo(() => {
  const ga = useArknights()
  const recruit = useRecruit()
  const names = useRecruitTagNames(recruit)
  const selected = useAtomValue(recruitTagsAtom)
  const combos = useGameDataMemo(
    () =>
      recruitCombos(selected, recruit, (charId) => {
        const c = ga.getCharacter(charId)
        // Character.rarity 从 0 起
        return c ? c.rarity + 1 : undefined
      }),
    [selected, recruit, ga],
  )
  // 选的词条一换，展开过的组合都收起：组合换了一批
  const [expanded, setExpanded] = useState<{ selected: number[]; keys: string[] }>({ selected, keys: [] })
  const open = expanded.selected === selected ? expanded.keys : []
  const expand = useEvent((key: string) => setExpanded({ selected, keys: [...open, key] }))

  return (
    <div className="cpp-recruit">
      <TagPicker recruit={recruit} names={names} />
      <div className={'cpp-recruit-hint ' + Classes.TEXT_MUTED}>
        {selected.length > 0
          ? gt.pgettext('recruit', '保底按招募时限 9 小时计')
          : gt.pgettext('recruit', '选上公招界面给出的词条')}
      </div>
      {selected.length > 0
        ? combos.map((combo) => {
            const key = combo.tags.join()
            return <ComboBlock key={key} combo={combo} names={names} expanded={open.includes(key)} onExpand={expand} />
          })
        : null}
    </div>
  )
})

export const recruitPanel: SidebarPanel = {
  id: RECRUIT_PANEL,
  icon: 'people',
  label: lpstr(() => gt.pgettext('sidebar panel', '公招')),
  title: lpstr(() => gt.pgettext('sidebar panel', '公开招募')),
  Body: RecruitBody,
  Toolbar: RecruitToolbar,
  isAvailable: (ga) => (ga as ArknightsAdapter).getDataManager().recruit.tags.length > 0,
}
