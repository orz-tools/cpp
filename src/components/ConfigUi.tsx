import {
  Button,
  Checkbox,
  H5,
  Icon,
  InputGroup,
  Menu,
  MenuDivider,
  MenuItem,
  NonIdealState,
  Popover,
  Tag,
} from '@blueprintjs/core'
import { useAtom, useAtomValue } from 'jotai'
import { without } from 'ramda'
import React, { memo, useState } from 'react'
import { useAtoms, useCpp, useGameAdapter, useGameDataGeneration } from '../Cpp'
import { useComponents } from '../hooks/useComponents'
import { gt } from '../pkg/gt'
import { DescriptionMenuItem } from './AboutList'
import { StageCategoryGroup, groupStages } from './stageGroups'
import { SampleTag } from './Value'

export const ForbiddenFormulaTag = memo(({ tag, text }: { tag: string; text: React.ReactNode }) => {
  const atoms = useAtoms()
  const [tags, setTags] = useAtom(atoms.forbiddenFormulaTagsAtom)
  return (
    <MenuItem
      icon={tags.includes(tag) ? 'tick' : 'blank'}
      text={text}
      onClick={() =>
        setTags((t) => {
          if (t.includes(tag)) return without([tag], t)
          return [...t, tag]
        })
      }
    />
  )
})

export const ConfigButton = memo(() => {
  const ga = useGameAdapter()
  const { ConfigMenuItems } = useComponents()
  const tags = Object.entries(ga.getFormulaTagNames())
  return (
    <Popover
      usePortal={true}
      minimal={true}
      content={
        <Menu>
          {tags.map(([k, v]) => {
            return <ForbiddenFormulaTag key={k} tag={k} text={v.toString()} />
          })}
          {ConfigMenuItems && tags.length > 0 ? <MenuDivider /> : null}
          {ConfigMenuItems ? <ConfigMenuItems /> : null}
        </Menu>
      }
      position="bottom-left"
    >
      <Button icon={'properties'} variant="minimal" endIcon={'chevron-down'}>
        <span className="cpp-very-compact">{gt.gettext('选项')}</span>
      </Button>
    </Popover>
  )
})

export interface StageToggleProps {
  isChecked: (stageId: string) => boolean
  onSetChecked: (stageIds: string[], checked: boolean) => void
}

export const StageIdCheckbox = memo(({ stageId, isChecked, onSetChecked }: { stageId: string } & StageToggleProps) => {
  const ga = useGameAdapter()
  const stageInfo = ga.getStageInfos()
  const stage = stageInfo[stageId]
  const samples = Math.max(
    -Infinity,
    ...Object.values(stage.dropInfo)
      .map((x) => x[1])
      .filter((x) => Number.isFinite(x)),
  )

  return (
    <Checkbox
      style={{ marginBottom: 0 }}
      checked={isChecked(stageId)}
      title={`${stageId}: ${stage.name}`}
      labelElement={
        <>
          <code title={`${stageId}: ${stage.name}`}>{stage.code}</code>
          {Number.isFinite(samples) ? (
            <SampleTag minimal sample={samples} style={{ marginLeft: '0.25em', verticalAlign: 'top' }} />
          ) : null}
        </>
      }
      inline={true}
      onChange={() => onSetChecked([stageId], !isChecked(stageId))}
    />
  )
})

function countChecked(stageIds: string[], isChecked: (stageId: string) => boolean) {
  let on = 0
  for (const x of stageIds) if (isChecked(x)) on++
  return on
}

export const TriStateCheckbox = ({
  stageIds,
  isChecked,
  onSetChecked,
  label,
  title,
}: StageToggleProps & { stageIds: string[]; label?: React.ReactNode; title?: string }) => {
  const all = stageIds.length
  const on = countChecked(stageIds, isChecked)
  const checked = all > 0 && on === all
  return (
    <Checkbox
      style={{ marginBottom: 0 }}
      inline={true}
      checked={checked}
      indeterminate={on > 0 && on < all}
      disabled={all === 0}
      labelElement={label}
      title={title}
      onChange={() => onSetChecked(stageIds, !checked)}
    />
  )
}

export const CountTag = ({ stageIds, isChecked }: { stageIds: string[]; isChecked: (stageId: string) => boolean }) => (
  <Tag minimal>
    {countChecked(stageIds, isChecked)}/{stageIds.length}
  </Tag>
)

const categoryStageIds = (group: StageCategoryGroup | undefined) =>
  group ? group.zones.flatMap((x) => x.stageIds) : []

export const StagePopover = memo(
  ({ isChecked, onSetChecked, stageIds }: StageToggleProps & { stageIds?: string[] }) => {
    const ga = useGameAdapter()
    const stageInfo = ga.getStageInfos()
    const allStageIds = stageIds || Object.keys(stageInfo)
    const zoneInfos = ga.getZoneInfos()
    const categories = ga.getStageCategories()
    const [query, setQuery] = useState('')
    const [selectedCategoryId, setSelectedCategoryId] = useState<string>()

    const groups = groupStages(allStageIds, stageInfo, zoneInfos, categories, '')
    const filtering = query.trim() !== ''
    const shown = filtering ? groupStages(allStageIds, stageInfo, zoneInfos, categories, query) : groups
    const shownStageIds = shown.flatMap(categoryStageIds)
    const selected = groups.find((x) => x.category.id === selectedCategoryId) || groups[0]
    const toggle = { isChecked, onSetChecked }

    const renderZones = (group: StageCategoryGroup) =>
      group.zones.map(({ zone, stageIds }) => (
        <div key={zone.id} className="cpp-stage-zone">
          <div className="cpp-stage-zone-header">
            <TriStateCheckbox {...toggle} stageIds={stageIds} title={zone.id} label={<b>{zone.name || zone.id}</b>} />
            <CountTag stageIds={stageIds} isChecked={isChecked} />
          </div>
          <div className="cpp-stage-zone-stages">
            {stageIds.map((x) => (
              <StageIdCheckbox stageId={x} key={x} {...toggle} />
            ))}
          </div>
        </div>
      ))

    let right: React.ReactNode
    if (shownStageIds.length === 0) {
      right = <NonIdealState icon="search" title={gt.gettext('无匹配关卡')} />
    } else if (filtering) {
      right = shown.map((group) => (
        <React.Fragment key={group.category.id}>
          <H5 className="cpp-stage-category-title">{group.category.name}</H5>
          {renderZones(group)}
        </React.Fragment>
      ))
    } else if (selected) {
      right = renderZones(selected)
    }

    return (
      <div className="cpp-stage-popover">
        <div className="cpp-stage-popover-toolbar">
          <InputGroup
            type="search"
            leftIcon="search"
            placeholder={gt.gettext('按关卡代号或名称筛选')}
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            fill={true}
          />
          <Button
            text={gt.gettext('全部启用')}
            disabled={shownStageIds.length === 0}
            onClick={() => onSetChecked(shownStageIds, true)}
          />
          <Button
            text={gt.gettext('全部禁用')}
            disabled={shownStageIds.length === 0}
            onClick={() => onSetChecked(shownStageIds, false)}
          />
        </div>
        <div className="cpp-stage-popover-body">
          <Menu className="cpp-stage-popover-categories">
            {groups.map((group) => {
              const ids = categoryStageIds(filtering ? shown.find((x) => x.category.id === group.category.id) : group)
              return (
                <MenuItem
                  key={group.category.id}
                  active={!filtering && group === selected}
                  disabled={ids.length === 0}
                  shouldDismissPopover={false}
                  onClick={() => setSelectedCategoryId(group.category.id)}
                  icon={
                    // 菜单项被点击会切换选中的分类，复选框只负责开关
                    <span onClick={(e) => e.stopPropagation()}>
                      <TriStateCheckbox {...toggle} stageIds={ids} />
                    </span>
                  }
                  text={group.category.name}
                  htmlTitle={group.category.name}
                  labelElement={<CountTag stageIds={ids} isChecked={isChecked} />}
                />
              )
            })}
          </Menu>
          <div className="cpp-stage-popover-zones">{right}</div>
        </div>
      </div>
    )
  },
)

export const SoulButton = memo(() => {
  const cpp = useCpp()
  const [blobFlavour, setBlobFlavour] = useAtom(cpp.preferenceAtoms.blobFlavourAtom)

  const handleClick = () => {
    setBlobFlavour((a) => {
      if (a === 'normal') return 'soul'
      return 'normal'
    })
  }

  return (
    <Button icon={'image-rotate-right'} variant="minimal" active={blobFlavour !== 'normal'} onClick={handleClick}>
      <span className="cpp-very-compact">?</span>
    </Button>
  )
})

export const MaybeSoulButton = memo(() => {
  const cpp = useCpp()
  // const blobFlavour = useAtomValue(cpp.preferenceAtoms.blobFlavourAtom)
  const flavours = cpp.gameComponent.blobFlavours
  const shouldShow = flavours?.length === 1 ? false : true
  return shouldShow ? <SoulButton /> : null
})

export const RegionButton = memo(() => {
  const cpp = useCpp()
  // The region is the committed one, so it changes with the generation.
  useGameDataGeneration()
  const { updating } = useAtomValue(cpp.gameDataStatusAtom)
  const { region, gameAdapterStatic } = cpp
  const regions = gameAdapterStatic.getRegions() || []
  if (regions.length <= 1) return null
  const currentRegion = regions.find((x) => x.id === region)

  return (
    <Popover
      usePortal={true}
      minimal={true}
      content={
        <Menu style={{ maxWidth: '300px' }}>
          <MenuDivider title={gt.gettext('游戏服务器')} />
          {regions.map((x) => {
            return (
              <MenuItem
                key={x.id}
                text={x.name}
                labelElement={
                  x.short ? (
                    <Tag minimal style={{ fontFamily: 'monospace' }}>
                      {x.short}
                    </Tag>
                  ) : null
                }
                active={x.id === region}
                disabled={updating}
                onClick={() => void cpp.setRegion(x.id)}
              />
            )
          })}
          <MenuDivider />
          <DescriptionMenuItem
            icon={'info-sign'}
            text={gt.gettext('免责声明')}
            description={
              'The names, abbreviations, and codes of countries, regions, and languages are presented in their original form as accurately as possible, and do not reflect any political biases held by the developer.'
            }
          />
        </Menu>
      }
      position="bottom-right"
    >
      <Button
        icon={
          <>
            <Icon icon={'globe'} />
          </>
        }
        variant="minimal"
        endIcon={'chevron-down'}
      >
        {currentRegion?.short ? (
          <Tag minimal style={{ fontFamily: 'monospace' }} className="cpp-very-compact">
            {currentRegion.short}
          </Tag>
        ) : (
          <span className="cpp-very-compact">{currentRegion?.name || region}</span>
        )}
      </Button>
    </Popover>
  )
})
