import { Button, InputGroup, Tooltip } from '@blueprintjs/core'
import React, { memo, useId, useRef, useState } from 'react'
import { CharacterLevel } from '../../../pkg/cpp-arknights'
import {
  EditedCharacter,
  compareLevel,
  editableUniEquips,
  elite2LevelBuckets,
  levelToRail,
  maxEliteOf,
  railLayout,
  railToLevel,
  sectionCollapsed,
  setEliteLevel,
  stepLevel,
} from '../../../pkg/cpp-arknights/statusEdit'
import { HeyboxSurveySource } from '../../../pkg/cpp-arknights/survey'
import { gt } from '../../../pkg/gt'
import elite0 from '../assets/elite0-small.png'
import elite1 from '../assets/elite1-small.png'
import elite2 from '../assets/elite2-small.png'
import { Delta, Section } from './SectionHeader'
import { isFewSamples, statTooltip } from './SurveyStat'
import { useEditor } from './context'
import { eliteLevelText, eliteName } from './text'

const eliteIcons = [elite0, elite1, elite2]

export const RAIL_WIDTH = 236
/** The phases end short of the rail's column, so the knob's ring clears the level box at the top level. */
const TRACK_WIDTH = RAIL_WIDTH - 4
/** A share label under the E2 level distribution, px; labels that would overlap move right, under the level box. */
const BUCKET_LABEL_WIDTH = 26

function topLevel(character: EditedCharacter): CharacterLevel {
  const elite = maxEliteOf(character)
  return { elite, level: character.maxLevels[elite] }
}

/** Position along all phases, for aria-valuenow: E1 1 of a 5★ is 51. */
function levelIndex(character: EditedCharacter, { elite, level }: CharacterLevel) {
  return character.maxLevels.slice(0, elite).reduce((a, b) => a + b, 0) + level
}

export const EliteLevelSection = memo(() => {
  const { character, status, current, setStatus } = useEditor()
  const titleId = useId()
  // While the rail is dragged, the knob and the box follow it; the status is written once, on release.
  const [preview, setPreview] = useState<CharacterLevel | null>(null)
  const shown = preview ?? status
  // A goal starts at the current status, or at E0 1 when it plans recruiting.
  const floor = current && current.level > 0 ? { elite: current.elite, level: current.level } : { elite: 0, level: 1 }
  const set = (at: CharacterLevel) => {
    if (compareLevel(at, status) !== 0) setStatus((x) => setEliteLevel(x, at))
  }

  return (
    <Section
      id={titleId}
      title={gt.pgettext('arknights status editor', '精英化与等级')}
      summary={current ? <Delta from={eliteLevelText(current)} to={eliteLevelText(status)} /> : eliteLevelText(status)}
      collapsed={current ? sectionCollapsed('elite', character, current) : false}
    >
      <div className="cpp-charstat-lv">
        <LevelRail shown={shown} floor={floor} setPreview={setPreview} set={set} labelledBy={titleId} />
        <LevelBox shown={shown} floor={floor} set={set} />
      </div>
    </Section>
  )
})

const LevelRail = memo(
  ({
    shown,
    floor,
    setPreview,
    set,
    labelledBy,
  }: {
    shown: CharacterLevel
    floor: CharacterLevel
    setPreview: (x: CharacterLevel | null) => void
    set: (x: CharacterLevel) => void
    labelledBy: string
  }) => {
    const { character, current, survey, surveyName } = useEditor()
    const trackRef = useRef<HTMLDivElement>(null)
    const dragging = useRef(false)
    // Where the pointer would set the level; below the current status, a goal cannot go
    const [hover, setHover] = useState<{ at: CharacterLevel; blocked: boolean } | null>(null)

    const segments = railLayout(character, TRACK_WIDTH)
    const top = topLevel(character)
    const x = (at: CharacterLevel) => levelToRail(character, at, TRACK_WIDTH)
    const clamp = (at: CharacterLevel) => (compareLevel(at, floor) < 0 ? floor : at)
    const levelAt = (clientX: number) => {
      const r = trackRef.current!.getBoundingClientRect()
      return railToLevel(character, ((clientX - r.left) * TRACK_WIDTH) / r.width, TRACK_WIDTH)
    }

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return
      e.currentTarget.setPointerCapture(e.pointerId)
      e.currentTarget.focus()
      dragging.current = true
      setPreview(clamp(levelAt(e.clientX)))
    }
    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      const at = levelAt(e.clientX)
      if (dragging.current) {
        setPreview(clamp(at))
        setHover(null)
      } else {
        setHover({ at, blocked: compareLevel(at, floor) < 0 })
      }
    }
    const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return
      dragging.current = false
      setPreview(null)
      set(clamp(levelAt(e.clientX)))
    }
    const onPointerCancel = () => {
      dragging.current = false
      setPreview(null)
    }
    const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      const deltas: Record<string, 1 | -1 | 10 | -10> = {
        ArrowLeft: -1,
        ArrowDown: -1,
        ArrowRight: 1,
        ArrowUp: 1,
        PageUp: 10,
        PageDown: -10,
      }
      let next: CharacterLevel | undefined
      if (e.key in deltas) next = stepLevel(character, shown, deltas[e.key], floor)
      else if (e.key === 'Home') next = floor
      else if (e.key === 'End') next = top
      if (!next) return
      e.preventDefault()
      set(next)
    }

    // Fraction of phase `elite` that `at` covers
    const frac = (elite: number, at: CharacterLevel | undefined) =>
      !at ? 0 : at.elite > elite ? 1 : at.elite < elite ? 0 : at.level / character.maxLevels[elite]

    const eliteShares = survey ? [survey.elite0(character), survey.elite1(character), survey.elite2(character)] : []
    const hasMods = segments.length > 2 && editableUniEquips(character).length > 0
    const buckets =
      survey instanceof HeyboxSurveySource
        ? elite2LevelBuckets(
            character,
            ([1, 70, 90] as const).map((r) => survey.e2level(character, r)?.percent),
          )
        : []
    const bucketTop = hasMods ? 57 : 34
    const height = buckets.length ? bucketTop + 18 : hasMods ? 54 : 34

    // Each label sits centred under its line, pushed right of the one before it so that none overlap.
    let nextFree = -Infinity
    const bucketLayout = buckets.map((b) => {
      const x0 = x({ elite: 2, level: b.from - 1 })
      const x1 = x({ elite: 2, level: b.to })
      const left = Math.max((x0 + x1) / 2 - BUCKET_LABEL_WIDTH / 2, nextFree)
      nextFree = left + BUCKET_LABEL_WIDTH + 6
      return { ...b, x0, x1, left }
    })

    return (
      <div className="cpp-charstat-rail" style={{ width: RAIL_WIDTH, height }}>
        {segments.map((seg) => {
          const s = eliteShares[seg.elite]
          const share = s && Number.isFinite(s.percent) ? s : null
          const label = (
            <span
              className={'cpp-charstat-rail-label' + (share && isFewSamples(share.samples) ? ' cpp-charstat-few' : '')}
            >
              {eliteName(seg.elite)}
              {share ? <span className="cpp-charstat-num"> {(share.percent * 100).toFixed(1)}</span> : null}
            </span>
          )
          return (
            <div key={seg.elite} className="cpp-charstat-rail-label-wrap" style={{ left: seg.start }}>
              {share ? (
                <Tooltip
                  compact
                  openOnTargetFocus={false}
                  placement="top"
                  hoverOpenDelay={150}
                  content={statTooltip(eliteName(seg.elite), share.percent, share.samples, 'owned', surveyName)}
                >
                  {label}
                </Tooltip>
              ) : (
                label
              )}
            </div>
          )
        })}
        <div
          ref={trackRef}
          className={'cpp-charstat-rail-track' + (hover?.blocked ? ' cpp-charstat-rail-blocked' : '')}
          style={{ width: TRACK_WIDTH }}
          role="slider"
          tabIndex={0}
          aria-labelledby={labelledBy}
          aria-valuemin={levelIndex(character, floor)}
          aria-valuemax={levelIndex(character, top)}
          aria-valuenow={levelIndex(character, shown)}
          aria-valuetext={eliteLevelText(shown)}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onPointerLeave={() => setHover(null)}
          onKeyDown={onKeyDown}
        >
          {segments.map((seg) => {
            const have = frac(seg.elite, current)
            const filled = Math.max(frac(seg.elite, shown), have)
            return (
              <div
                key={seg.elite}
                className="cpp-charstat-rail-seg"
                style={
                  { left: seg.start, width: seg.width, '--t': `${(seg.width * 10) / seg.max}px` } as React.CSSProperties
                }
              >
                {have > 0 ? <i className="cpp-charstat-rail-have" style={{ width: `${have * 100}%` }} /> : null}
                {filled > have ? (
                  <i
                    className="cpp-charstat-rail-on"
                    style={{ left: `${have * 100}%`, width: `${(filled - have) * 100}%` }}
                  />
                ) : null}
              </div>
            )
          })}
          {current && current.level > 0 ? (
            <span className="cpp-charstat-rail-current" style={{ left: x(current) }} />
          ) : null}
          <span className="cpp-charstat-rail-knob" style={{ left: x(shown) }} />
          {hover && !hover.blocked && compareLevel(hover.at, shown) !== 0 ? (
            <span className="cpp-charstat-rail-hint" style={{ left: x(hover.at) }} aria-hidden="true">
              {eliteLevelText(hover.at)}
            </span>
          ) : null}
        </div>
        {hasMods ? (
          <>
            <span
              className="cpp-charstat-rail-mod"
              style={{ left: x({ elite: 2, level: character.modUnlockLevel }) }}
            />
            <span
              className="cpp-charstat-rail-mod-label"
              style={{ left: x({ elite: 2, level: character.modUnlockLevel }) }}
            >
              {gt.pgettext('arknights status editor', '模组')}
            </span>
          </>
        ) : null}
        {bucketLayout.map((b) => {
          const what =
            b.from === b.to
              ? eliteLevelText({ elite: 2, level: b.to })
              : b.to < character.maxLevels[2]
                ? gt
                    .pgettext('arknights status editor', '%s %1–%2 级') /* I10N: %s: 精二; %1–%2: level range */
                    .replaceAll('%s', eliteName(2))
                    .replaceAll('%1', `${b.from}`)
                    .replaceAll('%2', `${b.to}`)
                : gt
                    .pgettext('arknights status editor', '%s %d 级以上') /* I10N: %s: 精二; %d: level */
                    .replaceAll('%s', eliteName(2))
                    .replaceAll('%d', `${b.from}`)
          return (
            <React.Fragment key={b.from}>
              <span
                className={'cpp-charstat-bucket-line' + (b.isMax ? ' cpp-charstat-bucket-max' : '')}
                style={{ top: bucketTop, left: b.x0 + 1, width: Math.max(b.x1 - b.x0 - 1, 2) }}
              />
              <Tooltip
                compact
                openOnTargetFocus={false}
                placement="bottom"
                hoverOpenDelay={150}
                className="cpp-charstat-bucket-wrap"
                content={statTooltip(what, b.share, NaN, 'elite2', surveyName)}
              >
                <span
                  className={'cpp-charstat-bucket' + (b.isMax ? ' cpp-charstat-bucket-max' : '')}
                  style={{ top: bucketTop + 2, left: b.left, width: BUCKET_LABEL_WIDTH }}
                >
                  {(b.share * 100).toFixed(1)}
                </span>
              </Tooltip>
            </React.Fragment>
          )
        })}
      </div>
    )
  },
)

/** The level as one value with its phase: ↑ / ↓ step a level, across phases; typing stays inside the phase. */
const LevelBox = memo(
  ({ shown, floor, set }: { shown: CharacterLevel; floor: CharacterLevel; set: (x: CharacterLevel) => void }) => {
    const { character } = useEditor()
    const [text, setText] = useState(String(shown.level))
    const [synced, setSynced] = useState(shown)
    if (synced.elite !== shown.elite || synced.level !== shown.level) {
      setSynced(shown)
      setText(String(shown.level))
    }

    const top = topLevel(character)
    const atFloor = compareLevel(shown, floor) <= 0
    const atTop = compareLevel(shown, top) >= 0
    const step = (delta: 1 | -1) => set(stepLevel(character, shown, delta, floor))
    const commit = () => {
      const n = parseInt(text, 10)
      if (!Number.isFinite(n)) {
        setText(String(shown.level))
        return
      }
      const level = Math.min(Math.max(n, 1), character.maxLevels[shown.elite])
      const at = { elite: shown.elite, level }
      const next = compareLevel(at, floor) < 0 ? floor : at
      setText(String(next.level))
      set(next)
    }

    return (
      <InputGroup
        className="cpp-charstat-lvbox"
        value={text}
        inputMode="numeric"
        aria-label={`${gt.pgettext('arknights status editor', '等级')} · ${eliteName(shown.elite)}`}
        leftElement={
          <img className="cpp-charstat-lvbox-elite" src={eliteIcons[shown.elite]} alt={eliteName(shown.elite)} />
        }
        rightElement={
          <span className="cpp-charstat-lvbox-steps">
            <Button
              variant="minimal"
              size="small"
              icon="chevron-up"
              tabIndex={-1}
              disabled={atTop}
              aria-label={gt.pgettext('arknights status editor', '升一级')}
              onClick={() => step(1)}
            />
            <Button
              variant="minimal"
              size="small"
              icon="chevron-down"
              tabIndex={-1}
              disabled={atFloor}
              aria-label={gt.pgettext('arknights status editor', '降一级')}
              onClick={() => step(-1)}
            />
          </span>
        }
        onChange={(e) => setText(e.currentTarget.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault()
            step(e.key === 'ArrowUp' ? 1 : -1)
          }
        }}
      />
    )
  },
)
