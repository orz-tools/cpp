import React, { memo, useId } from 'react'
import { Character, UniEquip } from '../../../pkg/cpp-arknights'
import {
  editableUniEquips,
  modChanges,
  raisesPrerequisite,
  sectionCollapsed,
  setMod,
} from '../../../pkg/cpp-arknights/statusEdit'
import { toTierShares } from '../../../pkg/cpp-arknights/survey'
import { gt } from '../../../pkg/gt'
import { CachedImg } from '../../Icons'
import { ProfessionIcon } from '../Icons'
import { DetailToggle, ModDetail } from './Detail'
import { Delta, Section } from './SectionHeader'
import { StepGroup } from './StepGroup'
import { SurveyStat, statTooltip } from './SurveyStat'
import { useEditor } from './context'
import { changesText, prerequisiteText } from './text'

const LEVELS = [0, 1, 2, 3]

/**
 * What the summary calls a module: X, Y, D…, or the full code when two share a letter, as the forms of 阿米娅 do.
 */
function modCoder(equips: UniEquip[]) {
  const letter = (equip: UniEquip) => equip.raw.typeName2 || equip.raw.typeName1
  const letters = equips.map(letter)
  const unique = new Set(letters).size === letters.length
  return (equip: UniEquip) =>
    unique || !equip.raw.typeName2 ? letter(equip) : `${equip.raw.typeName1}-${equip.raw.typeName2}`
}

function modLevelName(level: number) {
  return level === 0
    ? gt.pgettext('arknights status editor', '未解锁')
    : gt
        .pgettext('arknights status editor', '%d 级') /* I10N: %d: skill or module level */
        .replaceAll('%d', `${level}`)
}

export const ModSection = memo(() => {
  const { character, status, current, survey } = useEditor()
  const titleId = useId()
  if (character.rarity < 3) return null
  const mods = editableUniEquips(character)
  if (!mods.length) return null

  const modCode = modCoder(mods.map((m) => m.equip))
  let summary: React.ReactNode = mods.map((m) => `${modCode(m.equip)} ${status.modLevel[m.equipId] || 0}`).join(' · ')
  if (current) {
    const changes = modChanges(character, current, status)
    if (changes.length > 1) {
      summary = changesText(changes.length)
    } else if (changes.length === 1) {
      const c = changes[0]
      const equip = mods.find((m) => m.equipId === c.modId)!.equip
      summary = <Delta from={`${modCode(equip)} ${c.from}`} to={`${c.to}`} />
    } else {
      summary = mods.map((m) => `${modCode(m.equip)} ${current.modLevel[m.equipId] || 0}`).join(' · ')
    }
  }

  const tiers = new Map(
    survey ? mods.map((m) => [m.equipId, toTierShares(survey.mod(character, m.equip, m.rawCharId))]) : [],
  )
  const anyStats = [...tiers.values()].some(Boolean)
  // Heybox has no unlock rate for modules, so its shares stay of those who unlocked them.
  const unlockedBase = [...tiers.values()].some((t) => t?.base === 'unlocked')

  return (
    <Section
      id={titleId}
      title={gt.pgettext('arknights status editor', '模组')}
      summary={summary}
      collapsed={current ? sectionCollapsed('mod', character, current) : false}
    >
      {anyStats ? (
        <div className="cpp-charstat-legend">
          {unlockedBase
            ? gt.pgettext('arknights status editor', '小黑盒：解锁者中各级的占比')
            : gt.pgettext('arknights status editor', '精二干员中练到这一档的占比')}
        </div>
      ) : null}
      {mods.map((m) => (
        <ModRow key={m.equipId} charMod={m} tiers={tiers.get(m.equipId) ?? null} />
      ))}
    </Section>
  )
})

const ModRow = memo(
  ({ charMod, tiers }: { charMod: Character['uniEquips'][number]; tiers: ReturnType<typeof toTierShares> }) => {
    const { character, status, current, setStatus, surveyName, openDetail } = useEditor()
    const nameId = useId()
    const panelId = useId()
    const { equipId, equip } = charMod
    const detailKey = `mod:${equipId}`
    const value = status.modLevel[equipId] || 0
    const currentValue = current ? current.modLevel[equipId] || 0 : undefined
    const code = `${equip.raw.typeName1}-${equip.raw.typeName2}`

    return (
      <>
        <div className="cpp-charstat-row">
          <div className="cpp-charstat-lbl">
            {character.hasPatches ? (
              <ProfessionIcon profession={character.getPatchProfession(charMod.rawCharId)} />
            ) : null}
            <span className="cpp-charstat-modicon">
              <CachedImg src={equip.icon} width={16} height={16} alt="" />
            </span>
            <span className="cpp-charstat-code" title={equipId}>
              {code}
            </span>
            <span className="cpp-charstat-name" id={nameId} title={equip.name}>
              {equip.name}
            </span>
            <DetailToggle id={detailKey} panelId={panelId} name={equip.name} />
          </div>
          <div>
            <StepGroup
              labelledBy={nameId}
              values={LEVELS}
              value={value}
              current={currentValue}
              label={modLevelName}
              prerequisite={(v) => {
                const p = raisesPrerequisite(status, character, { kind: 'mod', modId: equipId, level: v })
                return p ? { p, text: prerequisiteText(p, true) } : null
              }}
              onPick={(v) => setStatus((x) => setMod(x, character, equipId, v))}
            />
            {tiers ? (
              <div className="cpp-charstat-stats">
                {LEVELS.map((v) => (
                  <SurveyStat
                    key={v}
                    share={tiers.shares[v]}
                    samples={tiers.samples}
                    target={currentValue !== undefined && value > currentValue && v === value}
                    tooltip={statTooltip(
                      `${equip.name} · ${modLevelName(v)}`,
                      tiers.shares[v] ?? NaN,
                      tiers.samples,
                      tiers.base,
                      surveyName,
                    )}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
        {openDetail === detailKey ? <ModDetail panelId={panelId} equipId={equipId} /> : null}
      </>
    )
  },
)
