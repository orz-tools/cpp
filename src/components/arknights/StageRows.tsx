import { Button, Callout, Checkbox, Icon, NonIdealState, SegmentedControl, Tag } from '@blueprintjs/core'
import { memo } from 'react'
import { useGameAdapter } from '../../Cpp'
import type { IStageInfo, IZoneInfo } from '../../pkg/cpp-basic'
import { MaterialGroup, StageDrop } from '../../pkg/cpp-arknights/stageEfficiency'
import { ArknightsStageCategory } from '../../pkg/cpp-arknights/zones'
import { gt } from '../../pkg/gt'
import type { StageToggleProps } from '../ConfigUi'
import { ItemIcon } from '../Icons'
import { SampleTag } from '../Value'
import {
  StageModel,
  StageView,
  efficiencyTone,
  formatEfficiency,
  formatEfficiencyShort,
  materialName,
} from './stagePanelModel'

export const EfficiencyText = memo(
  ({
    value,
    lowSample,
    short,
    className,
  }: {
    value: number | undefined
    lowSample?: boolean
    /** 取整，用在大窗口的材料格里 */
    short?: boolean
    className?: string
  }) => {
    const tone = efficiencyTone(value, lowSample)
    return (
      <span className={['cpp-stages-eff', tone ? 'cpp-stages-eff-' + tone : '', className].filter(Boolean).join(' ')}>
        {short ? formatEfficiencyShort(value) : formatEfficiency(value)}
      </span>
    )
  },
)

export const StageCheckbox = memo(
  ({ stage, isChecked, onSetChecked, label = true }: { stage: IStageInfo; label?: boolean } & StageToggleProps) => {
    const checked = isChecked(stage.id)
    return (
      <Checkbox
        className="cpp-stages-check"
        checked={checked}
        title={`${stage.id}: ${stage.name}`}
        labelElement={
          label ? (
            <code className="cpp-stages-code" title={`${stage.id}: ${stage.name}`}>
              {stage.code}
            </code>
          ) : undefined
        }
        aria-label={label ? undefined : stage.code}
        onChange={() => onSetChecked([stage.id], !checked)}
      />
    )
  },
)

export const ZoneShortName = memo(({ zone, full }: { zone: IZoneInfo | undefined; full?: boolean }) => {
  if (!zone) return null
  const name = (full ? zone.name : zone.shortName || zone.name) || zone.id
  return (
    <>
      <span className="cpp-stages-zone-short" title={zone.name || zone.id}>
        {name}
      </span>
      {zone.categoryId === ArknightsStageCategory.Activity ? (
        <Tag minimal intent="success" className="cpp-stages-event">
          {gt.pgettext('stage panel', '活动')}
        </Tag>
      ) : null}
    </>
  )
})

export const MaterialLabel = memo(({ itemId, size = 20 }: { itemId: string; size?: number }) => {
  const ga = useGameAdapter()
  return (
    <>
      <ItemIcon item={ga.getItem(itemId)} size={size} />
      <span className="cpp-stages-material-name">{materialName(ga, itemId)}</span>
    </>
  )
})

const formatQuantity = (quantity: number) => quantity.toFixed(2).replace(/\.?0+$/, '')

export const DropList = memo(({ drops }: { drops: StageDrop[] }) => {
  const ga = useGameAdapter()
  return (
    <span className="cpp-stages-drops">
      {drops.map((x) => (
        <span key={x.itemId} className="cpp-stages-drop">
          <ItemIcon item={ga.getItem(x.itemId)} size={22} />
          {`×${formatQuantity(x.quantity)}`}
        </span>
      ))}
    </span>
  )
})

export const MaterialStageRow = memo(
  ({ model, stageId, isChecked, onSetChecked }: { model: StageModel; stageId: string } & StageToggleProps) => {
    const stage = model.stages[stageId]
    const e = model.efficiencies.get(stageId)
    return (
      <div className={'cpp-stages-mrow' + (isChecked(stageId) ? '' : ' cpp-stages-off')}>
        <StageCheckbox stage={stage} isChecked={isChecked} onSetChecked={onSetChecked} />
        <span className="cpp-stages-mrow-zone cpp-stages-dim">
          <ZoneShortName zone={model.zones[stage.zoneId]} />
        </span>
        <span className="cpp-stages-mrow-eff cpp-stages-dim">
          {e?.lowSample ? <SampleTag minimal sample={e.samples} /> : null}
          <EfficiencyText value={model.valuesOk ? e?.efficiency : undefined} lowSample={e?.lowSample} />
        </span>
      </div>
    )
  },
)

const TOP = 3

export const MaterialGroupCard = memo(
  ({
    model,
    group,
    onOpen,
    ...toggle
  }: { model: StageModel; group: MaterialGroup; onOpen: (itemId: string) => void } & StageToggleProps) => {
    const ga = useGameAdapter()
    const top: string[] = []
    for (const id of group.stageIds) {
      if (top.length >= TOP || !model.efficiencies.get(id)?.ranked) break
      top.push(id)
    }
    const more = group.stageIds.length - top.length
    return (
      <div className="cpp-stages-group">
        <button
          type="button"
          className="cpp-stages-group-head"
          title={materialName(ga, group.itemId)}
          onClick={() => onOpen(group.itemId)}
        >
          <MaterialLabel itemId={group.itemId} size={24} />
          <EfficiencyText value={group.best} />
          <Icon icon="chevron-right" />
        </button>
        {top.map((id) => (
          <MaterialStageRow key={id} model={model} stageId={id} {...toggle} />
        ))}
        {more > 0 ? (
          <Button
            variant="minimal"
            size="small"
            intent="primary"
            className="cpp-stages-more"
            endIcon="chevron-right"
            onClick={() => onOpen(group.itemId)}
          >
            {gt
              .ngettext('另外 %d 关', '另外 %d 关', more) /* I10N: %d: number */
              .replaceAll('%d', String(more))}
          </Button>
        ) : null}
      </div>
    )
  },
)

export const StageViewSwitch = memo(
  ({ view, onChange, fill }: { view: StageView; onChange: (view: StageView) => void; fill?: boolean }) => (
    <SegmentedControl
      className="cpp-stages-views"
      intent="primary"
      size="small"
      fill={fill}
      value={view}
      onValueChange={(x) => onChange(x as StageView)}
      options={[
        { label: gt.pgettext('stage panel', '按章节'), value: 'chapter' },
        { label: gt.pgettext('stage panel', '按材料'), value: 'material' },
      ]}
    />
  ),
)

export const ValuesFailedCallout = () => (
  <Callout intent="warning" compact className="cpp-stages-callout">
    {gt.pgettext('stage panel', '物品价值计算失败，暂时无法显示效率；关卡的启用、禁用不受影响')}
  </Callout>
)

export const MaterialEmpty = ({ model, shown }: { model: StageModel; shown: number }) => {
  if (!model.valuesOk)
    return <NonIdealState icon="warning-sign" title={gt.pgettext('stage panel', '物品价值计算失败')} />
  if (shown === 0) return <NonIdealState icon="search" title={gt.pgettext('stage panel', '无匹配材料')} />
  return null
}
