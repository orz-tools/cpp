import { Callout } from '@blueprintjs/core'
import { useAtomValue } from 'jotai'
import React, { memo, useLayoutEffect, useMemo, useRef, useState } from 'react'
import useEvent from 'react-use-event-hook'
import { useAtoms, useCpp, useGameAdapter } from '../../Cpp'
import { getLocale } from '../../locales'
import { AK_ITEM_GOLD, AK_ITEM_VIRTUAL_EXP, Arknights, ArknightsAdapter, Character } from '../../pkg/cpp-arknights'
import { CostBreakdown, CostCellId, CostMatrix, RarityRank, TrainingCost } from '../../pkg/cpp-arknights/trainingCost'
import { ICharacter } from '../../pkg/cpp-basic'
import { gt, lpstr } from '../../pkg/gt'
import { CachedImg } from '../Icons'
import { ValueTag, ValueText, ValueUnitIcon } from '../Value'
import { DossierSection } from '../types'

const cellTitles: Record<CostCellId, () => string> = {
  zeroNow: () => gt.pgettext('training cost', '从零到现在的材料'),
  zeroGoal: () => gt.pgettext('training cost', '从零到目标的材料'),
  zeroFull: () => gt.pgettext('training cost', '从零到满的材料'),
  nowGoal: () => gt.pgettext('training cost', '现在到目标的材料'),
  nowFull: () => gt.pgettext('training cost', '现在到满的材料'),
  goalFull: () => gt.pgettext('training cost', '目标到满的材料'),
}

interface TrackLabel {
  /** 0–1 */
  at: number
  text: React.ReactNode
}

/** 两个标签之间至少留这么宽 */
const LABEL_GAP = 6

/**
 * 零、现在、目标、满画在一条线上。段的名字比段宽时不写；相邻两个点的名字挤在一起时，只留靠两头的那个，竖线照画。
 */
const CostTrack = memo(({ matrix }: { matrix: CostMatrix }) => {
  const { invested, remaining, rest } = matrix.track
  const total = (invested?.value ?? 0) + (remaining?.value ?? 0) + rest.value
  const segments = [
    invested && { kind: 'invested', name: gt.pgettext('training cost', '已投入'), cost: invested },
    remaining && { kind: 'remaining', name: gt.pgettext('training cost', '还差'), cost: remaining },
    {
      kind: 'rest',
      name: matrix.planned ? gt.pgettext('training cost', '计划之后') : gt.pgettext('training cost', '拉满'),
      cost: rest,
    },
  ].filter((x) => !!x)
  let from = 0
  const spans = segments.map((s) => {
    const width = s.cost.value / total
    const span = { ...s, from, width }
    from += width
    return span
  })
  const points: TrackLabel[] = [
    { at: 0, text: gt.pgettext('training cost', '零') },
    ...(invested ? [{ at: spans[0].width, text: gt.pgettext('training cost', '现在') }] : []),
    ...(remaining ? [{ at: spans[spans.length - 1].from, text: gt.pgettext('training cost', '目标') }] : []),
    { at: 1, text: gt.pgettext('training cost', '满') },
  ]

  // 换价值单位时段的名字跟着变宽变窄，要重新量
  useAtomValue(useCpp().preferenceAtoms.valueTypeAtom)
  const ref = useRef<HTMLDivElement>(null)
  const [hidden, setHidden] = useState<{ segments: boolean[]; points: boolean[] }>()
  const measure = useEvent(() => {
    const el = ref.current
    if (!el) return
    const width = el.clientWidth
    const segmentEls = [...el.querySelectorAll<HTMLElement>('.cpp-cost-track-segment-label')]
    const pointEls = [...el.querySelectorAll<HTMLElement>('.cpp-cost-track-point-label')]
    const segmentsHidden = segmentEls.map((x, i) => x.offsetWidth > spans[i].width * width)
    // 先放靠两头的，挤到已经放下的就不放
    const boxes = points.map((p, i) => {
      const w = pointEls[i]?.offsetWidth ?? 0
      const left = i === 0 ? 0 : i === points.length - 1 ? width - w : p.at * width - w / 2
      return { i, left, right: left + w, priority: Math.min(p.at, 1 - p.at) }
    })
    const placed: typeof boxes = []
    for (const box of [...boxes].sort((a, b) => a.priority - b.priority)) {
      if (placed.every((p) => box.right + LABEL_GAP <= p.left || p.right + LABEL_GAP <= box.left)) placed.push(box)
    }
    const pointsHidden = points.map((_, i) => !placed.some((p) => p.i === i))
    setHidden((prev) =>
      prev && prev.segments.join() === segmentsHidden.join() && prev.points.join() === pointsHidden.join()
        ? prev
        : { segments: segmentsHidden, points: pointsHidden },
    )
  })
  // 每次画完都量：标签的字随数和单位变；setHidden 没变化时不会再画
  useLayoutEffect(() => measure())
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(() => measure())
    observer.observe(el)
    return () => observer.disconnect()
  }, [measure])

  if (!(total > 0)) return null

  const pct = (x: number) => `${(x * 100).toFixed(3)}%`
  const edge = (at: number) => (at === 0 ? ' is-first' : at === 1 ? ' is-last' : '')
  return (
    <div className="cpp-cost-track" ref={ref}>
      <div className="cpp-cost-track-segments">
        {spans.map((s, i) => (
          <span
            key={s.kind}
            className={'cpp-cost-track-segment-label' + (hidden?.segments[i] ? ' is-hidden' : '')}
            style={{ left: pct(s.from + s.width / 2) }}
          >
            {s.name} <ValueText value={s.cost.value} />
          </span>
        ))}
      </div>
      <div className="cpp-cost-track-bar">
        {spans.map((s) => (
          <span key={s.kind} className={`cpp-cost-track-${s.kind}`} style={{ width: pct(s.width) }} />
        ))}
        {points.map((p, i) => (
          <span key={i} className="cpp-cost-track-tick" style={{ left: pct(p.at) }} />
        ))}
      </div>
      <div className="cpp-cost-track-points">
        {points.map((p, i) => (
          <span
            key={i}
            className={'cpp-cost-track-point-label' + edge(p.at) + (hidden?.points[i] ? ' is-hidden' : '')}
            style={{ left: pct(p.at) }}
          >
            {p.text}
          </span>
        ))}
      </div>
    </div>
  )
})

/** 行是起点，列是终点；点一格，下面的材料换成这一段的 */
const CostTable = memo(
  ({
    matrix,
    selected,
    onSelect,
  }: {
    matrix: CostMatrix
    selected: CostCellId
    onSelect: (id: CostCellId) => void
  }) => {
    const { owned, planned, cells } = matrix
    const columns: [boolean, string][] = [
      [owned, gt.pgettext('training cost', '到现在')],
      [planned, gt.pgettext('training cost', '到目标')],
      [true, gt.pgettext('training cost', '到满')],
    ]
    const rows: [boolean, string, (CostCellId | null)[]][] = [
      [true, gt.pgettext('training cost', '从零'), ['zeroNow', 'zeroGoal', 'zeroFull']],
      [owned, gt.pgettext('training cost', '从现在'), [null, 'nowGoal', 'nowFull']],
      [planned, gt.pgettext('training cost', '从目标'), [null, null, 'goalFull']],
    ]
    return (
      <table className="cpp-cost-table">
        <thead>
          <tr>
            <th>
              <ValueUnitIcon />
            </th>
            {columns.map(([shown, label]) => (shown ? <th key={label}>{label}</th> : null))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([shown, label, ids]) =>
            shown ? (
              <tr key={label}>
                <th scope="row">{label}</th>
                {ids.map((id, i) => {
                  if (!columns[i][0]) return null
                  const cost = id ? cells[id] : undefined
                  if (!id || !cost) return <td key={i} />
                  return (
                    <td key={i}>
                      <button
                        type="button"
                        className={'cpp-cost-table-cell' + (id === selected ? ' is-selected' : '')}
                        aria-pressed={id === selected}
                        onClick={() => onSelect(id)}
                      >
                        <ValueText value={cost.value} />
                      </button>
                    </td>
                  )
                })}
              </tr>
            ) : null,
          )}
        </tbody>
      </table>
    )
  },
)

function formatQuantity(n: number) {
  if (n < 10000) return `${n}`
  return new Intl.NumberFormat(getLocale().replace('_', '-'), {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n)
}

const CostMaterials = memo(({ ga, title, cost }: { ga: ArknightsAdapter; title: string; cost: CostBreakdown }) => {
  const items = useMemo(() => {
    const rank = (id: string) => (id === AK_ITEM_VIRTUAL_EXP ? 0 : id === AK_ITEM_GOLD ? 1 : 2)
    return [...cost.items]
      .map(([id, quantity]) => ({ id, quantity, item: ga.getItem(id) }))
      .sort(
        (a, b) =>
          rank(a.id) - rank(b.id) ||
          (b.item?.rarity ?? 0) - (a.item?.rarity ?? 0) ||
          (a.item?.sortId ?? '').localeCompare(b.item?.sortId ?? ''),
      )
  }, [ga, cost])
  const separator = gt.pgettext('list separator', '、')
  return (
    <>
      <div className="cpp-cost-subtitle">{title}</div>
      {items.length > 0 ? (
        <div className="cpp-cost-materials">
          {items.map(({ id, quantity, item }) => {
            const name = item?.name ?? id
            return (
              <span key={id} className="cpp-cost-material" title={`${name} × ${quantity}`}>
                {item ? <CachedImg src={item.icon} width={34} height={34} alt={name} /> : null}
                <span className="cpp-cost-material-quantity">{formatQuantity(quantity)}</span>
              </span>
            )
          })}
        </div>
      ) : (
        <div className="cpp-cost-muted">—</div>
      )}
      {cost.unvalued.length > 0 ? (
        <div className="cpp-cost-muted cpp-cost-unvalued">
          {gt
            .pgettext('training cost', '%s没有价值，没算进上面的数') /* I10N: %s: item names */
            .replaceAll('%s', cost.unvalued.map((id) => ga.getItem(id)?.name ?? id).join(separator))}
        </div>
      ) : null}
    </>
  )
})

const STRIP_WIDTH = 120
const STRIP_HEIGHT = 10

/** 同星级每人一根灰色短线，这一位是一根蓝色长线；左边最少，右边最多 */
const RankStrip = memo(({ values, value }: { values: readonly number[]; value: number }) => {
  const hi = values[0]
  const lo = values[values.length - 1]
  const x = (v: number) => (hi === lo ? STRIP_WIDTH / 2 : 1 + ((v - lo) / (hi - lo)) * (STRIP_WIDTH - 2))
  const d = values.map((v) => `M${x(v).toFixed(1)} ${STRIP_HEIGHT - 5}V${STRIP_HEIGHT - 1}`).join('')
  return (
    <svg className="cpp-cost-strip" width={STRIP_WIDTH} height={STRIP_HEIGHT} aria-hidden="true">
      <path className="cpp-cost-strip-base" d={`M0 ${STRIP_HEIGHT - 0.5}H${STRIP_WIDTH}`} />
      <path className="cpp-cost-strip-peers" d={d} />
      <rect className="cpp-cost-strip-self" x={x(value) - 1.25} y={0} width={2.5} height={STRIP_HEIGHT} rx={1} />
    </svg>
  )
})

const RankCell = memo(({ rank, value }: { rank: RarityRank | null; value: number }) => {
  if (!rank) return null
  const parts = gt.pgettext('training cost', '第 %d$rank / %d$count').split(/(%d\$rank|%d\$count)/)
  return (
    <>
      <RankStrip values={rank.values} value={value} />
      <span className="cpp-cost-rank">
        {parts.map((part, i) =>
          part === '%d$rank' ? (
            <b key={i}>{rank.rank}</b>
          ) : part === '%d$count' ? (
            <span key={i} className="cpp-cost-muted">
              {rank.count}
            </span>
          ) : (
            <React.Fragment key={i}>{part}</React.Fragment>
          ),
        )}
      </span>
    </>
  )
})

interface VoucherRow {
  key: string
  itemId: string
  label: string
  saving: CostBreakdown
  rank: RarityRank | null | 'level'
}

const VoucherTable = memo(({ ga, tc, character }: { ga: ArknightsAdapter; tc: TrainingCost; character: Character }) => {
  const atoms = useAtoms<Arknights>()
  const current = useAtomValue(atoms.currentCharacter(character.key))
  const currents = useAtomValue(atoms.currentCharacters)
  const stars = character.rarity + 1
  const rows: VoucherRow[] = []
  const elite2 = tc.elite2Saving(character, current)
  if (elite2) {
    rows.push({
      key: 'elite2',
      itemId: `voucher_elite_II_${stars}`,
      label: gt.pgettext('training cost', '精二'),
      saving: elite2,
      rank: tc.rarityRank('elite2', character, undefined, currents),
    })
  }
  const skillRefs = [
    gt.pgettext('arknights skill ref', '一技能'),
    gt.pgettext('arknights skill ref', '二技能'),
    gt.pgettext('arknights skill ref', '三技能'),
  ]
  character.skills.forEach((skill, i) => {
    const saving = tc.mastery3Saving(character, current, i)
    if (!saving || saving.items.size === 0) return
    rows.push({
      key: `mastery3:${i}`,
      itemId: `voucher_skill_specialLevelMax_${stars}`,
      label: gt
        .pgettext('training cost', '%s专三') /* I10N: %s: 一技能, 二技能 or 三技能 */
        .replaceAll('%s', skillRefs[skill.charSkillIndex] ?? ''),
      saving,
      rank: tc.rarityRank('mastery3', character, i, currents),
    })
  })
  const levelMax = tc.levelMaxSaving(character, current)
  if (levelMax) {
    rows.push({
      key: 'levelMax',
      itemId: `voucher_levelmax_${stars}`,
      label: gt.pgettext('training cost', '精二满级'),
      saving: levelMax,
      rank: 'level',
    })
  }
  if (rows.length === 0) return null

  return (
    <>
      <div className="cpp-cost-subtitle">{gt.pgettext('training cost', '直升道具')}</div>
      <table className="cpp-cost-vouchers">
        <thead>
          <tr>
            <th />
            <th>{gt.pgettext('training cost', '在 %d 星里排第几').replaceAll('%d', `${stars}`)}</th>
            <th className="cpp-cost-vouchers-saving">{gt.pgettext('training cost', '能省')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const item = ga.getItem(row.itemId)
            return (
              <tr key={row.key}>
                <th scope="row">
                  <span className="cpp-cost-voucher">
                    {item ? (
                      <CachedImg src={item.icon} width={24} height={24} alt={item.name} title={item.name} />
                    ) : null}
                    {row.label}
                  </span>
                </th>
                <td>
                  {row.rank === 'level' ? (
                    <span className="cpp-cost-muted">{gt.pgettext('training cost', '不分干员，只看等级')}</span>
                  ) : (
                    <RankCell rank={row.rank} value={row.saving.value} />
                  )}
                </td>
                <td className="cpp-cost-vouchers-saving">
                  <ValueTag value={row.saving.value} minimal={true} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </>
  )
})

const CostSectionBody = memo(({ character }: { character: ICharacter }) => {
  const ga = useGameAdapter<Arknights>() as ArknightsAdapter
  const c = character as Character
  const atoms = useAtoms<Arknights>()
  const current = useAtomValue(atoms.currentCharacter(c.key))
  // goalCharacter() 没有计划时给的是现在的练度，分不出有没有计划
  const goal = useAtomValue(atoms.goalCharacters)[c.key]
  const tc = ga.getTrainingCost()
  const matrix = useMemo(() => tc.costMatrix(c, current, goal), [tc, c, current, goal])
  const [selected, setSelected] = useState<CostCellId>()
  // 选中的格不在这张表里了（例如刚取消了计划），回到默认格
  const cell = selected && matrix.cells[selected] ? selected : matrix.defaultCell

  return (
    <div className="cpp-cost">
      {tc.valuesOk ? (
        <CostTrack matrix={matrix} />
      ) : (
        <Callout intent="warning" compact={true} className="cpp-cost-warning">
          {gt.pgettext('training cost', '物品价值计算失败，暂时算不出价值；材料明细不受影响')}
        </Callout>
      )}
      <CostTable matrix={matrix} selected={cell} onSelect={setSelected} />
      <CostMaterials ga={ga} title={cellTitles[cell]()} cost={matrix.cells[cell]!} />
      {c.rarity >= 3 ? <VoucherTable ga={ga} tc={tc} character={c} /> : null}
    </div>
  )
})

export const costSection: DossierSection = {
  id: 'cost',
  title: lpstr(() => gt.pgettext('dossier section', '养成成本')),
  Body: CostSectionBody,
}
