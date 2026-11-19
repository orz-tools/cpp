import { Callout, SegmentedControl, Tooltip } from '@blueprintjs/core'
import { atom, useAtom, useAtomValue } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import React, { memo, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import useEvent from 'react-use-event-hook'
import { useAtoms, useCpp, useGameAdapter } from '../../Cpp'
import { AK_ITEM_GOLD, AK_ITEM_VIRTUAL_EXP, Arknights, ArknightsAdapter, Character } from '../../pkg/cpp-arknights'
import {
  CostBreakdown,
  CostCellId,
  CostMatrix,
  RarityRank,
  TrainingCost,
  VoucherSaving,
  efficiencyPercent,
  showsMost,
} from '../../pkg/cpp-arknights/trainingCost'
import { ICharacter } from '../../pkg/cpp-basic'
import { gt, lpstr } from '../../pkg/gt'
import { CachedImg } from '../Icons'
import { PeekTrigger } from '../Peek'
import { formatQuantity } from '../quantity'
import { ValueTag, ValueText, ValueUnitIcon } from '../Value'
import { DossierSection } from '../types'
import { MostText, fillNodes } from './voucherText'

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
    // 和画着的一样就不能调 setHidden：哪怕给回原来的值，React 也会把这一节再画一次，
    // 下面每次画完都量，就成了画不停（CPP-69）
    if (hidden && hidden.segments.join() === segmentsHidden.join() && hidden.points.join() === pointsHidden.join())
      return
    setHidden({ segments: segmentsHidden, points: pointsHidden })
  })
  // 每次画完都量：标签的字随数和单位变
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

type MaterialsMode = 'raw' | 'blue'

// 和 cpp_dossier 一样记在本机、不分档案
const materialsModeStorageAtom = atomWithStorage<unknown>('cpp_cost_materials', null, undefined, { getOnInit: true })
const materialsModeAtom = atom(
  (get): MaterialsMode => (get(materialsModeStorageAtom) === 'blue' ? 'blue' : 'raw'),
  (_get, set, mode: MaterialsMode) => set(materialsModeStorageAtom, mode),
)

function materialTitle(name: string, quantity: number, folded: number) {
  if (folded === 0) return `${name} × ${quantity}`
  return gt
    .pgettext('training cost', '%s × %d$total（直接 %d$direct，折算 %d$folded）') /* I10N: %s: item name */
    .replaceAll('%d$total', `${quantity}`)
    .replaceAll('%d$direct', `${quantity - folded}`)
    .replaceAll('%d$folded', `${folded}`)
    .replaceAll('%s', name)
}

const CostMaterials = memo(({ ga, title, cost }: { ga: ArknightsAdapter; title: string; cost: CostBreakdown }) => {
  const [mode, setMode] = useAtom(materialsModeAtom)
  const fold = useMemo(() => (mode === 'blue' ? ga.foldToBlue(cost.items) : null), [ga, cost, mode])
  const items = useMemo(() => {
    const rank = (id: string) => (id === AK_ITEM_VIRTUAL_EXP ? 0 : id === AK_ITEM_GOLD ? 1 : 2)
    return [...(fold?.items ?? cost.items)]
      .map(([id, quantity]) => ({ id, quantity, folded: fold?.folded.get(id) ?? 0, item: ga.getItem(id) }))
      .sort(
        (a, b) =>
          rank(a.id) - rank(b.id) ||
          (b.item?.rarity ?? 0) - (a.item?.rarity ?? 0) ||
          (a.item?.sortId ?? '').localeCompare(b.item?.sortId ?? ''),
      )
  }, [ga, cost, fold])
  const separator = gt.pgettext('list separator', '、')
  const titleId = useId()
  return (
    <>
      <div className="cpp-cost-materials-head" role="group" aria-labelledby={titleId}>
        <div className="cpp-cost-subtitle" id={titleId}>
          {title}
        </div>
        <SegmentedControl
          size="small"
          value={mode}
          onValueChange={(x) => setMode(x as MaterialsMode)}
          options={[
            { label: gt.pgettext('training cost', '原样'), value: 'raw' },
            { label: gt.pgettext('training cost', '折成蓝材料'), value: 'blue' },
          ]}
        />
      </div>
      {items.length > 0 ? (
        <div className="cpp-cost-materials">
          {items.map(({ id, quantity, folded, item }) => {
            const name = item?.name ?? id
            return (
              <PeekTrigger
                key={id}
                peek={{ kind: 'item', id }}
                renderTarget={(peek) => (
                  <span
                    role={peek ? 'button' : undefined}
                    {...peek}
                    className={'cpp-cost-material' + (peek ? ' ' + peek.className : '')}
                    title={materialTitle(name, quantity, folded)}
                  >
                    {item ? <CachedImg src={item.icon} width={34} height={34} alt={name} /> : null}
                    <span className="cpp-cost-material-quantity">{formatQuantity(quantity)}</span>
                  </span>
                )}
              />
            )
          })}
        </div>
      ) : (
        <div className="cpp-cost-muted">—</div>
      )}
      {fold && fold.unfolded.size > 0 ? (
        <div className="cpp-cost-muted cpp-cost-folded">
          {fold.fee > 0
            ? gt
                .pgettext('training cost', '金、紫材料按加工站配方折成了蓝材料；龙门币里有 %d 是合成费')
                .replaceAll('%d', `${fold.fee}`)
            : gt.pgettext('training cost', '金、紫材料按加工站配方折成了蓝材料')}
        </div>
      ) : null}
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
  voucher: VoucherSaving
  rank: RarityRank | null | 'level'
}

/** 列头上的术语，样子和打开方式同状态编辑器里的 */
const HeadTerm = memo(({ title, tip }: { title: string; tip: React.ReactNode }) => (
  <Tooltip
    content={
      <div className="cpp-charstat-term-tip">
        <b>{title}</b>
        {tip}
      </div>
    }
    placement="top"
    hoverOpenDelay={150}
  >
    <span className="cpp-charstat-term" tabIndex={0}>
      {title}
    </span>
  </Tooltip>
))

const EfficiencyTip = memo(({ tc, character }: { tc: TrainingCost; character: Character }) => (
  <div>
    {fillNodes(
      gt.pgettext(
        'training cost',
        '现在能省的，占这张道具在 %d 星干员身上最多能省的几成：精二 %s$elite2（从精零 1 级用），专三 %s$mastery3（从专零用），精二满级 %s$levelMax（从精二 1 级用）。',
      ) /* I10N: %d: 4, 5 or 6; %s$…: the most each voucher saves on an operator of that rarity */,
      {
        '%d': character.rarity + 1,
        '%s$elite2': <ValueText value={tc.rarityMax('elite2', character.rarity)} />,
        '%s$mastery3': <ValueText value={tc.rarityMax('mastery3', character.rarity)} />,
        '%s$levelMax': <ValueText value={tc.rarityMax('levelMax', character.rarity)} />,
      },
    )}
  </div>
))

const SavingTip = memo(() => (
  <>
    <div>
      {gt.pgettext('training cost', '现在用这张道具能省多少，从这名干员现在的练度算起；已经练过的那一段省不回来。')}
    </div>
    <div>
      {gt.pgettext(
        'training cost',
        '下面的「最多」是从能用这张道具的最早那一点用时能省的：精二从精零 1 级，专三从专零，满级从精二 1 级。',
      )}
    </div>
  </>
))

const VoucherTable = memo(({ ga, tc, character }: { ga: ArknightsAdapter; tc: TrainingCost; character: Character }) => {
  const atoms = useAtoms<Arknights>()
  const current = useAtomValue(atoms.currentCharacter(character.key))
  const currents = useAtomValue(atoms.currentCharacters)
  const stars = character.rarity + 1
  const rows: VoucherRow[] = []
  const elite2 = tc.voucher('elite2', character, current)
  if (elite2) {
    rows.push({
      key: 'elite2',
      itemId: `voucher_elite_II_${stars}`,
      label: gt.pgettext('training cost', '精二'),
      voucher: elite2,
      rank: tc.rarityRank('elite2', character, undefined, currents),
    })
  }
  const skillRefs = [
    gt.pgettext('arknights skill ref', '一技能'),
    gt.pgettext('arknights skill ref', '二技能'),
    gt.pgettext('arknights skill ref', '三技能'),
  ]
  character.skills.forEach((skill, i) => {
    const voucher = tc.voucher('mastery3', character, current, i)
    if (!voucher || voucher.now.items.size === 0) return
    rows.push({
      key: `mastery3:${i}`,
      itemId: `voucher_skill_specialLevelMax_${stars}`,
      label: gt
        .pgettext('training cost', '%s专三') /* I10N: %s: 一技能, 二技能 or 三技能 */
        .replaceAll('%s', skillRefs[skill.charSkillIndex] ?? ''),
      voucher,
      rank: tc.rarityRank('mastery3', character, i, currents),
    })
  })
  const levelMax = tc.voucher('levelMax', character, current)
  if (levelMax) {
    rows.push({
      key: 'levelMax',
      itemId: `voucher_levelmax_${stars}`,
      label: gt.pgettext('training cost', '精二满级'),
      voucher: levelMax,
      rank: 'level',
    })
  }
  if (rows.length === 0) return null

  return (
    <>
      <div className="cpp-cost-subtitle">{gt.pgettext('training cost', '直升道具')}</div>
      <div className="cpp-cost-vouchers-scroll">
        <table className="cpp-cost-vouchers">
          <thead>
            <tr>
              <th />
              <th>{gt.pgettext('training cost', '在 %d 星里排第几').replaceAll('%d', `${stars}`)}</th>
              <th className="cpp-cost-vouchers-eff">
                <HeadTerm
                  title={gt.pgettext('training cost', '效率')}
                  tip={<EfficiencyTip tc={tc} character={character} />}
                />
              </th>
              <th className="cpp-cost-vouchers-saving">
                <HeadTerm title={gt.pgettext('training cost', '现在用能省')} tip={<SavingTip />} />
              </th>
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
                      <RankCell rank={row.rank} value={row.voucher.now.value} />
                    )}
                  </td>
                  <td className="cpp-cost-vouchers-eff">
                    {Number.isFinite(row.voucher.efficiency) ? `${efficiencyPercent(row.voucher.efficiency)}%` : null}
                  </td>
                  <td className="cpp-cost-vouchers-saving">
                    <ValueTag value={row.voucher.now.value} minimal={true} />
                    {showsMost(row.voucher) ? (
                      <span className="cpp-cost-vouchers-most">
                        <MostText value={row.voucher.most.value} />
                      </span>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
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
  // 特殊干员的每一格都是 0
  isAvailable: (_ga, character) => !(character as Character).isSpecialOperator,
}
