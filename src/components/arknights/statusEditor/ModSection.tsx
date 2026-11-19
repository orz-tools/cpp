import { memo, useId } from 'react'
import { Character } from '../../../pkg/cpp-arknights'
import { editableUniEquips, raisesPrerequisite, setMod } from '../../../pkg/cpp-arknights/statusEdit'
import { toTierShares } from '../../../pkg/cpp-arknights/survey'
import { gt } from '../../../pkg/gt'
import { CachedImg } from '../../Icons'
import { ProfessionIcon } from '../Icons'
import { DetailToggle, ModDetail } from './Detail'
import { Section } from './Section'
import { StepGroup } from './StepGroup'
import { SurveyStat, statTooltip } from './SurveyStat'
import { useEditor } from './context'
import { prerequisiteText } from './text'

const LEVELS = [0, 1, 2, 3]

function modLevelName(level: number) {
  return level === 0
    ? gt.pgettext('arknights status editor', '未解锁')
    : gt
        .pgettext('arknights status editor', '%d 级') /* I10N: %d: skill or module level */
        .replaceAll('%d', `${level}`)
}

export const ModSection = memo(() => {
  const { character } = useEditor()
  if (character.rarity < 3) return null
  const mods = editableUniEquips(character)
  if (!mods.length) return null

  return (
    <Section title={gt.pgettext('arknights status editor', '模组')}>
      {mods.map((m) => (
        <ModRow key={m.equipId} charMod={m} />
      ))}
    </Section>
  )
})

const ModRow = memo(({ charMod }: { charMod: Character['uniEquips'][number] }) => {
  const { character, status, current, setStatus, survey, surveyName, openDetail } = useEditor()
  const nameId = useId()
  const panelId = useId()
  const { equipId, equip } = charMod
  const detailKey = `mod:${equipId}`
  const value = status.modLevel[equipId] || 0
  const currentValue = current ? current.modLevel[equipId] || 0 : undefined
  const tiers = survey ? toTierShares(survey.mod(character, equip, charMod.rawCharId)) : null
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
})
