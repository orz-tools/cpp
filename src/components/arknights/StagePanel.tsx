import { Button, InputGroup, NonIdealState, SegmentedControl, Tag } from '@blueprintjs/core'
import { useAtom } from 'jotai'
import { memo, useMemo } from 'react'
import type { IZoneInfo } from '../../pkg/cpp-basic'
import { MaterialGroup } from '../../pkg/cpp-arknights/stageEfficiency'
import { ArknightsStageCategory } from '../../pkg/cpp-arknights/zones'
import { gt, lpstr } from '../../pkg/gt'
import { CountTag, StageToggleProps, TriStateCheckbox } from '../ConfigUi'
import { groupStages } from '../stageGroups'
import type { SidebarPanel } from '../types'
import { StagesWide } from './StagePanelWide'
import {
  EfficiencyText,
  MaterialEmpty,
  MaterialGroupCard,
  MaterialLabel,
  MaterialStageRow,
  StageCheckbox,
  StageViewSwitch,
  ValuesFailedCallout,
} from './StageRows'
import {
  StageModel,
  categoryLabel,
  matchesStage,
  stageCategoryFilterAtom,
  stageZoneOpenAtom,
  useChapterCategories,
  useMaterialFilter,
  useScopedQuery,
  useStageModel,
  useStageNavigation,
  useStageToggle,
} from './stagePanelModel'

const StagesToolbar = memo(() => {
  const { enabled, total } = useStageToggle()
  return (
    <Tag minimal className="cpp-stages-total" title={gt.pgettext('stage panel', '已启用的关卡')}>
      {enabled}/{total}
    </Tag>
  )
})

const ChapterStageRow = memo(
  ({ model, stageId, isChecked, onSetChecked }: { model: StageModel; stageId: string } & StageToggleProps) => {
    const e = model.efficiencies.get(stageId)
    return (
      <div className={'cpp-stages-crow' + (isChecked(stageId) ? '' : ' cpp-stages-off')}>
        <StageCheckbox stage={model.stages[stageId]} isChecked={isChecked} onSetChecked={onSetChecked} />
        <span className="cpp-stages-crow-drop cpp-stages-dim">
          {e?.mainDrop && model.valuesOk ? <MaterialLabel itemId={e.mainDrop} /> : null}
        </span>
        <EfficiencyText
          className="cpp-stages-dim"
          value={model.valuesOk ? e?.efficiency : undefined}
          lowSample={e?.lowSample}
        />
      </div>
    )
  },
)

const ZoneBlock = memo(
  ({
    model,
    zone,
    stageIds,
    searching,
    isChecked,
    onSetChecked,
  }: { model: StageModel; zone: IZoneInfo; stageIds: string[]; searching: boolean } & StageToggleProps) => {
    const [zoneOpen, setZoneOpen] = useAtom(stageZoneOpenAtom)
    const remembered = zoneOpen[zone.id] ?? zone.categoryId === ArknightsStageCategory.Activity
    const open = searching || remembered
    const onToggle = () => setZoneOpen((x) => ({ ...x, [zone.id]: !remembered }))
    const name = zone.name || zone.id
    const on = stageIds.filter(isChecked).length
    return (
      <>
        <div className="cpp-stages-zone">
          <Button
            variant="minimal"
            size="small"
            className="cpp-stages-chevron"
            icon={open ? 'chevron-down' : 'chevron-right'}
            disabled={searching}
            aria-expanded={open}
            aria-label={name}
            onClick={onToggle}
          />
          <TriStateCheckbox isChecked={isChecked} onSetChecked={onSetChecked} stageIds={stageIds} title={zone.id} />
          <button type="button" className="cpp-stages-zone-name" title={name} disabled={searching} onClick={onToggle}>
            {name}
          </button>
          <span className="cpp-stages-count">
            {on}/{stageIds.length}
          </span>
          <EfficiencyText value={model.valuesOk ? model.zoneBest.get(zone.id) : undefined} />
        </div>
        {open
          ? stageIds.map((id) => (
              <ChapterStageRow key={id} model={model} stageId={id} isChecked={isChecked} onSetChecked={onSetChecked} />
            ))
          : null}
      </>
    )
  },
)

const ChapterTree = memo(
  ({
    model,
    category,
    query,
    toggle,
  }: {
    model: StageModel
    category: string | null
    query: string
    toggle: StageToggleProps
  }) => {
    const searching = query.trim() !== ''
    const groups = groupStages(Object.keys(model.stages), model.stages, model.zones, model.categories, query).filter(
      (x) => !category || x.category.id === category,
    )
    if (groups.length === 0) return <NonIdealState icon="search" title={gt.gettext('无匹配关卡')} />
    return groups.map((group) => {
      const ids = group.zones.flatMap((x) => x.stageIds)
      return (
        <section key={group.category.id}>
          <div className="cpp-stages-cat">
            <TriStateCheckbox {...toggle} stageIds={ids} label={group.category.name} />
            <CountTag stageIds={ids} isChecked={toggle.isChecked} />
          </div>
          {group.zones.map(({ zone, stageIds }) => (
            <ZoneBlock key={zone.id} model={model} zone={zone} stageIds={stageIds} searching={searching} {...toggle} />
          ))}
        </section>
      )
    })
  },
)

const MaterialOverview = memo(
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
    const groups = useMaterialFilter(model, query)
    return (
      <>
        <MaterialEmpty model={model} shown={groups.length} />
        {groups.map((g) => (
          <MaterialGroupCard key={g.itemId} model={model} group={g} onOpen={onOpen} {...toggle} />
        ))}
      </>
    )
  },
)

const MaterialDrill = memo(
  ({
    model,
    group,
    query,
    toggle,
    onClose,
  }: {
    model: StageModel
    group: MaterialGroup
    query: string
    toggle: StageToggleProps
    onClose: () => void
  }) => {
    const ids = group.stageIds.filter((id) => matchesStage(model.stages[id], query))
    const count = group.stageIds.length
    return (
      <>
        <div className="cpp-stages-drill-head">
          <Button variant="minimal" size="small" icon="chevron-left" onClick={onClose}>
            {gt.pgettext('stage panel', '全部材料')}
          </Button>
          <div className="cpp-stages-drill-title">
            <MaterialLabel itemId={group.itemId} size={28} />
            <span className="cpp-stages-muted">
              {gt
                .ngettext('%d 关 · 按效率排序', '%d 关 · 按效率排序', count) /* I10N: %d: number */
                .replaceAll('%d', String(count))}
            </span>
          </div>
        </div>
        {ids.length === 0 ? <NonIdealState icon="search" title={gt.gettext('无匹配关卡')} /> : null}
        {ids.map((id) => (
          <MaterialStageRow key={id} model={model} stageId={id} {...toggle} />
        ))}
      </>
    )
  },
)

const StagesBody = memo(() => {
  const model = useStageModel()
  const { isChecked, onSetChecked } = useStageToggle()
  const toggle = useMemo(() => ({ isChecked, onSetChecked }), [isChecked, onSetChecked])
  const nav = useStageNavigation(model)
  const [query, setQuery] = useScopedQuery(nav.scope)
  const categories = useChapterCategories(model)
  const [categoryFilter, setCategoryFilter] = useAtom(stageCategoryFilterAtom)
  const category = categories.some((x) => x.id === categoryFilter) ? categoryFilter : null
  const overview = nav.view === 'material' && !nav.drill

  let list: React.ReactNode
  if (nav.view === 'chapter') list = <ChapterTree model={model} category={category} query={query} toggle={toggle} />
  else if (nav.drill)
    list = <MaterialDrill model={model} group={nav.drill} query={query} toggle={toggle} onClose={nav.closeMaterial} />
  else list = <MaterialOverview model={model} query={query} toggle={toggle} onOpen={nav.openMaterial} />

  return (
    <div className="cpp-stages-body">
      <div className="cpp-stages-filter">
        <StageViewSwitch view={nav.view} onChange={nav.setView} fill />
        <InputGroup
          type="search"
          size="small"
          leftIcon="search"
          placeholder={overview ? gt.pgettext('stage panel', '材料名称') : gt.pgettext('stage panel', '关卡代号或名称')}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
        />
        {nav.view === 'chapter' ? (
          <SegmentedControl
            size="small"
            fill
            className="cpp-stages-categories"
            value={category ?? ''}
            onValueChange={(x) => setCategoryFilter(x || null)}
            options={[
              { label: gt.pgettext('stage panel', '全部'), value: '' },
              ...categories.map((x) => ({ label: categoryLabel(x), value: x.id })),
            ]}
          />
        ) : null}
      </div>
      {!model.valuesOk ? <ValuesFailedCallout /> : null}
      {/* 按显示的内容换 key，进入一种材料时从列表顶上开始 */}
      <div className="cpp-stages-list" key={nav.scope}>
        {list}
      </div>
    </div>
  )
})

export const stagesPanel: SidebarPanel = {
  id: 'stages',
  icon: 'layers',
  label: lpstr(() => gt.gettext('关卡')),
  title: lpstr(() => gt.gettext('关卡')),
  Body: StagesBody,
  Toolbar: StagesToolbar,
  Wide: StagesWide,
}
