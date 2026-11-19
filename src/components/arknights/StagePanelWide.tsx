import { Button, H6, HTMLTable, InputGroup, Menu, MenuItem, NonIdealState, ProgressBar, Tag } from '@blueprintjs/core'
import { useAtomValue } from 'jotai'
import { selectAtom } from 'jotai/utils'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { useGameAdapter } from '../../Cpp'
import { MaterialGroup } from '../../pkg/cpp-arknights/stageEfficiency'
import { gt } from '../../pkg/gt'
import { CountTag, StageToggleProps, TriStateCheckbox } from '../ConfigUi'
import { ItemIcon } from '../Icons'
import { focusFrameAtom, measureIn, useFocusFrame } from '../focusFrame'
import { StageCategoryGroup, groupStages } from '../stageGroups'
import { ValueTag } from '../Value'
import { useDropDataNotice } from './DropDataMissing'
import {
  DropList,
  EfficiencyText,
  MaterialEmpty,
  MaterialGroupCard,
  MaterialLabel,
  StageCheckbox,
  StageViewSwitch,
  StockSummary,
  ValuesFailedCallout,
  ZoneShortName,
} from './StageRows'
import {
  StageModel,
  efficiencyTone,
  materialName,
  materialSectionName,
  matchesStage,
  useMaterialFilter,
  useScopedQuery,
  useStageModel,
  useStageNavigation,
  useStageToggle,
} from './stagePanelModel'

const StageTableRow = memo(
  ({
    model,
    stageId,
    withZone,
    isChecked,
    onSetChecked,
  }: { model: StageModel; stageId: string; withZone: boolean } & StageToggleProps) => {
    const stage = model.stages[stageId]
    const e = model.efficiencies.get(stageId)
    const efficiency = model.valuesOk ? e?.efficiency : undefined
    const ref = useRef<HTMLTableRowElement>(null)
    const framed = useFocusFrame('stage:' + stageId, ref)
    const className = [isChecked(stageId) ? '' : 'cpp-stages-off', framed ? 'cpp-framed' : ''].filter(Boolean).join(' ')
    return (
      <tr ref={ref} className={className || undefined}>
        <td>
          <StageCheckbox stage={stage} label={false} isChecked={isChecked} onSetChecked={onSetChecked} />
        </td>
        <td className="cpp-stages-dim">
          <Tag title={`${stage.id}: ${stage.name}`}>
            <code className="cpp-stages-code">{stage.code}</code>
          </Tag>
        </td>
        {withZone ? (
          <td className="cpp-stages-dim">
            <ZoneShortName zone={model.zones[stage.zoneId]} full />
          </td>
        ) : null}
        <td className="cpp-stages-num cpp-stages-dim">{stage.ap}</td>
        <td className="cpp-stages-dim">
          <span className="cpp-stages-bar-cell">
            {efficiency !== undefined ? (
              <ProgressBar
                className="cpp-stages-bar"
                value={Math.min(1, efficiency / 1.2)}
                intent={efficiencyTone(efficiency) === 'up' ? 'success' : 'primary'}
                animate={false}
                stripes={false}
              />
            ) : null}
            <EfficiencyText value={efficiency} lowSample={e?.lowSample} />
          </span>
        </td>
        <td className="cpp-stages-num cpp-stages-dim">
          <ValueTag value={model.valuesOk ? e?.value : undefined} minimal />
        </td>
        <td className="cpp-stages-dim">{e && model.valuesOk ? <DropList drops={e.topDrops} /> : null}</td>
        <td className={'cpp-stages-num cpp-stages-dim' + (e?.lowSample ? ' cpp-stages-eff-low' : '')}>
          {e?.samples ?? '—'}
        </td>
      </tr>
    )
  },
)

const StageTable = memo(
  ({
    model,
    ids,
    withZone,
    toggle,
  }: {
    model: StageModel
    ids: string[]
    withZone: boolean
    toggle: StageToggleProps
  }) => (
    <HTMLTable compact className={'cpp-stages-table' + (withZone ? '' : ' cpp-stages-table-fixed')}>
      <thead>
        <tr>
          <th />
          <th className="cpp-stages-col-code">{gt.gettext('关卡')}</th>
          {withZone ? <th>{gt.pgettext('stage panel', '章节')}</th> : null}
          <th className="cpp-stages-num cpp-stages-col-ap">{gt.pgettext('stage panel', '理智')}</th>
          <th className="cpp-stages-col-eff">{gt.pgettext('stage panel', '效率')}</th>
          <th className="cpp-stages-num cpp-stages-col-value">{gt.pgettext('stage panel', '每次掉落价值')}</th>
          <th>{gt.pgettext('stage panel', '主要掉落（每次）')}</th>
          <th className="cpp-stages-num cpp-stages-col-samples">{gt.pgettext('stage panel', '样本')}</th>
        </tr>
      </thead>
      <tbody>
        {ids.map((id) => (
          <StageTableRow key={id} model={model} stageId={id} withZone={withZone} {...toggle} />
        ))}
      </tbody>
    </HTMLTable>
  ),
)

const stageFrameRequestAtom = selectAtom(focusFrameAtom, (r) => (r?.target.startsWith('stage:') ? r : null))

const categoryIds = (group: StageCategoryGroup | undefined) => (group ? group.zones.flatMap((x) => x.stageIds) : [])

// 表头和一行的实际高度：还没画的表格先占住画出来以后的位置，点左边的类别时才能滚到准确的地方
const TABLE_HEAD_HEIGHT = 31.5
const TABLE_ROW_HEIGHT = 39.5

/** 一次画出全部约 570 行，窗口要卡一秒左右，所以表格滚到可见区域附近才画，画过就一直留着 */
const LazyTable = ({ rows, children }: { rows: number; children: React.ReactNode }) => {
  const ref = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (near || !el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((x) => x.isIntersecting)) setNear(true)
      },
      { root: el.closest('.cpp-stages-wide-scroll'), rootMargin: '600px 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [near])
  if (near) return children
  return <div ref={ref} style={{ height: TABLE_HEAD_HEIGHT + rows * TABLE_ROW_HEIGHT }} />
}

const ChapterWide = memo(
  ({
    model,
    all,
    shown,
    filtering,
    toggle,
  }: {
    model: StageModel
    all: StageCategoryGroup[]
    shown: StageCategoryGroup[]
    filtering: boolean
    toggle: StageToggleProps
  }) => {
    const zonesRef = useRef<HTMLDivElement>(null)
    // 要框出的一关在没画出来的表格里：先把它的章节滚进来，表格画出来以后，那一行自己接住请求
    const request = useAtomValue(stageFrameRequestAtom)
    useEffect(() => {
      const zoneId = request && model.stages[request.target.slice('stage:'.length)]?.zoneId
      const scroll = zonesRef.current
      const zone = zoneId && scroll?.querySelector<HTMLElement>(`[data-stage-zone="${CSS.escape(zoneId)}"]`)
      if (!scroll || !zone) return
      scroll.scrollTop += measureIn(zone, scroll).top
    }, [request, model])
    return (
      <div className="cpp-stages-wide-chapter">
        <Menu className="cpp-stages-wide-categories">
          {all.map((group) => {
            const id = group.category.id
            const ids = categoryIds(filtering ? shown.find((x) => x.category.id === id) : group)
            return (
              <MenuItem
                key={id}
                text={group.category.name}
                disabled={ids.length === 0}
                onClick={() =>
                  zonesRef.current
                    ?.querySelector(`[data-stage-category="${CSS.escape(id)}"]`)
                    ?.scrollIntoView({ block: 'start' })
                }
                icon={
                  // 点菜单项滚到这个类别，复选框只负责开关
                  <span onClick={(e) => e.stopPropagation()}>
                    <TriStateCheckbox {...toggle} stageIds={ids} />
                  </span>
                }
                labelElement={<CountTag stageIds={ids} isChecked={toggle.isChecked} />}
              />
            )
          })}
        </Menu>
        <div className="cpp-stages-wide-scroll" ref={zonesRef}>
          {shown.length === 0 ? <NonIdealState icon="search" title={gt.gettext('无匹配关卡')} /> : null}
          {shown.map((group) => (
            <section key={group.category.id}>
              <div className="cpp-stages-wide-section" data-stage-category={group.category.id}>
                {group.category.name}
              </div>
              {group.zones.map(({ zone, stageIds }) => (
                <div key={zone.id} className="cpp-stages-wide-zone" data-stage-zone={zone.id}>
                  <div className="cpp-stages-wide-zone-head">
                    <TriStateCheckbox {...toggle} stageIds={stageIds} title={zone.id} label={zone.name || zone.id} />
                    <CountTag stageIds={stageIds} isChecked={toggle.isChecked} />
                  </div>
                  <LazyTable rows={stageIds.length}>
                    <StageTable model={model} ids={stageIds} withZone={false} toggle={toggle} />
                  </LazyTable>
                </div>
              ))}
            </section>
          ))}
        </div>
      </div>
    )
  },
)

const MaterialWide = memo(
  ({
    model,
    query,
    toggle,
    onOpen,
  }: {
    model: StageModel
    query: string
    toggle: StageToggleProps
    onOpen: (itemId: string) => void
  }) => {
    const sections = useMaterialFilter(model, query)
    return (
      <div className="cpp-stages-wide-scroll">
        <MaterialEmpty model={model} shown={sections.length} />
        {sections.map(({ section, groups }) => (
          <section key={section}>
            <div className="cpp-stages-wide-section">{materialSectionName(section)}</div>
            <div className="cpp-stages-wide-columns">
              {groups.map((g) => (
                <MaterialGroupCard key={g.itemId} model={model} group={g} onOpen={onOpen} {...toggle} />
              ))}
            </div>
          </section>
        ))}
      </div>
    )
  },
)

const DrillWide = memo(
  ({
    model,
    group,
    ids,
    toggle,
    onSelect,
    onClose,
  }: {
    model: StageModel
    group: MaterialGroup
    ids: string[]
    toggle: StageToggleProps
    onSelect: (itemId: string) => void
    onClose: () => void
  }) => {
    const ga = useGameAdapter()
    const best = useMemo(() => new Map(model.groups.map((g) => [g.itemId, g.best])), [model])
    return (
      <div className="cpp-stages-wide-drill">
        <div className="cpp-stages-wide-materials">
          <H6 className="cpp-stages-wide-materials-title">
            {gt.pgettext('stage panel', '换一种材料 · 数字是它最高的关卡效率')}
          </H6>
          <div className="cpp-stages-wide-grid">
            {model.depotOrder.map((id) => (
              <button
                key={id}
                type="button"
                className={'cpp-stages-cell' + (id === group.itemId ? ' cpp-stages-cell-active' : '')}
                title={materialName(ga, id)}
                aria-pressed={id === group.itemId}
                onClick={() => onSelect(id)}
              >
                <ItemIcon item={ga.getItem(id)} size={30} />
                <EfficiencyText value={best.get(id)} short />
              </button>
            ))}
          </div>
        </div>
        {/* 按材料换 key，换一种材料时表格从顶上开始 */}
        <div className="cpp-stages-wide-scroll" key={group.itemId}>
          <div className="cpp-stages-wide-drill-head">
            <Button variant="minimal" size="small" icon="chevron-left" onClick={onClose}>
              {gt.pgettext('stage panel', '全部材料')}
            </Button>
            <MaterialLabel itemId={group.itemId} size={24} />
            <StockSummary groupId={group.itemId} />
          </div>
          {ids.length === 0 ? (
            <NonIdealState icon="search" title={gt.gettext('无匹配关卡')} />
          ) : (
            <StageTable model={model} ids={ids} withZone toggle={toggle} />
          )}
        </div>
      </div>
    )
  },
)

const StagesWideContent = memo(() => {
  const model = useStageModel()
  const { isChecked, onSetChecked, enabled, total } = useStageToggle()
  const toggle = useMemo(() => ({ isChecked, onSetChecked }), [isChecked, onSetChecked])
  const nav = useStageNavigation(model)
  const [query, setQuery] = useScopedQuery(nav.scope)
  const allIds = useMemo(() => Object.keys(model.stages), [model])
  const all = useMemo(() => groupStages(allIds, model.stages, model.zones, model.categories, ''), [allIds, model])

  // 「全部启用」「全部禁用」作用于显示出来的关卡，和原来的「关卡」弹层一样
  let shownIds: string[] | undefined
  let body: React.ReactNode
  if (nav.view === 'chapter') {
    const filtering = query.trim() !== ''
    const shown = filtering ? groupStages(allIds, model.stages, model.zones, model.categories, query) : all
    shownIds = shown.flatMap(categoryIds)
    body = <ChapterWide model={model} all={all} shown={shown} filtering={filtering} toggle={toggle} />
  } else if (nav.drill) {
    shownIds = nav.drill.stageIds.filter((id) => matchesStage(model.stages[id], query))
    body = (
      <DrillWide
        model={model}
        group={nav.drill}
        ids={shownIds}
        toggle={toggle}
        onSelect={nav.openMaterial}
        onClose={nav.closeMaterial}
      />
    )
  } else {
    body = <MaterialWide model={model} query={query} toggle={toggle} onOpen={nav.openMaterial} />
  }
  const overview = nav.view === 'material' && !nav.drill
  const hint = overview ? gt.pgettext('stage panel', '图标角上是库存，「需」是需求；点材料看它的全部关卡') : undefined
  const actOn = shownIds

  return (
    <div className="cpp-stages-wide">
      <div className="cpp-stages-wide-bar">
        <StageViewSwitch view={nav.view} onChange={nav.setView} />
        <InputGroup
          className="cpp-stages-wide-search"
          type="search"
          leftIcon="search"
          placeholder={overview ? gt.pgettext('stage panel', '材料名称') : gt.pgettext('stage panel', '关卡代号或名称')}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
        />
        {hint ? (
          // 窄窗口下英文会被截断，悬停看全文
          <span className="cpp-stages-muted cpp-stages-wide-hint" title={hint}>
            {hint}
          </span>
        ) : null}
        <span className="cpp-stages-spacer" />
        <Tag minimal className="cpp-stages-total">
          {gt
            .pgettext('stage panel', '已启用 %s') /* I10N: %s: enabled stages / all stages, e.g. 534/571 */
            .replaceAll('%s', `${enabled}/${total}`)}
        </Tag>
        {actOn ? (
          <>
            <Button
              text={gt.gettext('全部启用')}
              disabled={actOn.length === 0}
              onClick={() => onSetChecked(actOn, true)}
            />
            <Button
              text={gt.gettext('全部禁用')}
              disabled={actOn.length === 0}
              onClick={() => onSetChecked(actOn, false)}
            />
          </>
        ) : null}
      </div>
      {!model.valuesOk ? <ValuesFailedCallout /> : null}
      <div className="cpp-stages-wide-body" key={nav.view === 'chapter' ? 'chapter' : nav.drill ? 'drill' : 'material'}>
        {body}
      </div>
      <div className="cpp-stages-wide-foot">
        {gt.pgettext(
          'stage panel',
          '效率 = 每次掉落价值 ÷ 理智。物品价值按「价值计算」的设置算出；活动代币没有价值，不计入。',
        )}
      </div>
    </div>
  )
})

export const StagesWide = memo(() => useDropDataNotice() ?? <StagesWideContent />)
