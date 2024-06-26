import { Button, Card, Checkbox, Icon, Menu, MenuDivider, MenuItem, Popover, Tag } from '@blueprintjs/core'
import { useAtom, useAtomValue } from 'jotai'
import { groupBy, sortBy, without } from 'ramda'
import React, { memo } from 'react'
import { useAtoms, useCpp, useGameAdapter } from '../Cpp'
import { gt } from '../pkg/gt'
import { DescriptionMenuItem } from './AboutList'
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
        </Menu>
      }
      position="bottom-left"
    >
      <Button icon={'properties'} minimal={true} rightIcon={'chevron-down'}>
        <span className="cpp-very-compact">{gt.gettext('选项')}</span>
      </Button>
    </Popover>
  )
})

export const ForbiddenStageIdTag = memo(({ stageId }: { stageId: string }) => {
  const ga = useGameAdapter()
  const stageInfo = ga.getStageInfos()
  const stage = stageInfo[stageId]
  const cpp = useCpp()
  const [ids, setIds] = useAtom(cpp.preferenceAtoms.forbiddenStageIdsAtom)
  const samples = Math.max(
    -Infinity,
    ...Object.values(stage.dropInfo)
      .map((x) => x[1])
      .filter((x) => Number.isFinite(x)),
  )

  return (
    <Checkbox
      style={{ marginBottom: 0 }}
      checked={!ids.includes(stageId)}
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
      onChange={() =>
        setIds((t) => {
          if (t.includes(stageId)) return without([stageId], t)
          return [...t, stageId]
        })
      }
    />
  )
})

function makeNumericSortable(x: string) {
  return x.replace(/\d+/g, (y) => String(y).padStart(20, '0'))
}

export const StagePopover = memo(() => {
  const ga = useGameAdapter()
  const stageInfo = ga.getStageInfos()
  const allStageIds = Object.keys(stageInfo)
  const grouped = sortBy(
    (x) => makeNumericSortable(x[0]),
    Object.entries(
      groupBy(
        (x: string) => {
          return stageInfo[x].zoneId
        },
        sortBy((x) => {
          return makeNumericSortable(stageInfo[x].sortKey)
        }, allStageIds),
      ),
    ),
  )

  return (
    <div style={{ minWidth: '200px', maxWidth: '60vw', maxHeight: '80vh', overflow: 'auto' }}>
      {grouped.map(([k, stages]) => {
        const zoneName = ga.getZoneNames()[k] || k
        return (
          <React.Fragment key={k}>
            <Card style={{ padding: 15 }}>
              <h4 style={{ margin: 0, padding: 0 }} title={k}>
                {zoneName}
              </h4>
              {stages!.map((x) => {
                return <ForbiddenStageIdTag stageId={x} key={x} />
              })}
            </Card>
          </React.Fragment>
        )
      })}
    </div>
  )
})

export const StageButton = memo(() => {
  const ga = useGameAdapter()
  const cpp = useCpp()
  const stageInfo = ga.getStageInfos()
  const forbiddenStageIds = useAtomValue(cpp.preferenceAtoms.forbiddenStageIdsAtom)
  const allStageIds = Object.keys(stageInfo)
  const now = without(forbiddenStageIds, allStageIds).length
  const all = allStageIds.length

  return (
    <Popover usePortal={true} minimal={true} content={<StagePopover />} position="bottom-left">
      <Button
        icon={'layers'}
        minimal={true}
        rightIcon={
          <>
            <Tag minimal className="cpp-very-compact">
              {now}/{all}
            </Tag>
            <Icon icon={'chevron-down'} />
          </>
        }
      >
        <span className="cpp-very-compact">{gt.gettext('关卡')}</span>
      </Button>
    </Popover>
  )
})

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
    <Button icon={'image-rotate-right'} minimal={true} active={blobFlavour !== 'normal'} onClick={handleClick}>
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
                onClick={() => {
                  cpp.setRegion(x.id)
                }}
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
        minimal={true}
        rightIcon={'chevron-down'}
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
