import { Button, Card, Checkbox, Menu, MenuItem } from '@blueprintjs/core'
import { Popover2 } from '@blueprintjs/popover2'
import { useAtom, useAtomValue } from 'jotai'
import { groupBy, sortBy, without } from 'ramda'
import React from 'react'
import { useInject } from '../hooks/useContainer'
import { FormulaTag } from '../pkg/cpp-core/DataManager'
import { diffGroupName, FarmPlannerFactory } from '../pkg/cpp-core/FarmPlanner'
import { forbiddenFormulaTagsAtom, forbiddenStageIdsAtom } from './Config'

export function ForbiddenFormulaTag({ tag, text }: { tag: FormulaTag; text: React.ReactNode }) {
  const [tags, setTags] = useAtom(forbiddenFormulaTagsAtom)
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
}

export function ConfigButton() {
  return (
    <Popover2
      usePortal={true}
      minimal={true}
      content={
        <Menu>
          <ForbiddenFormulaTag tag={FormulaTag.WorkshopRarity2} text="不从绿材料合成蓝材料" />
        </Menu>
      }
      position="bottom-left"
    >
      <Button icon={'properties'} minimal={true} rightIcon={'chevron-down'}>
        选项
      </Button>
    </Popover2>
  )
}

export function ForbiddenStageIdTag({ stageId }: { stageId: string }) {
  const stageInfo = useInject(FarmPlannerFactory).getStageInfo()
  const stage = stageInfo[stageId]
  const [ids, setIds] = useAtom(forbiddenStageIdsAtom)

  return (
    <Checkbox
      style={{ marginBottom: 0 }}
      checked={!ids.includes(stageId)}
      title={`${stageId}: ${stage.excel.name}`}
      labelElement={
        <>
          <code title={`${stageId}: ${stage.excel.name}`}>
            {diffGroupName[stage.excel.diffGroup]}
            {stage.excel.code}
          </code>
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
}

function makeNumericSortable(x: string) {
  return x.replace(/\d+/g, (y) => String(y).padStart(20, '0'))
}

const zoneReplacement: Record<string, string> = {
  weekly_1: 'weekly_chips',
  weekly_2: 'weekly_chips',
  weekly_3: 'weekly_chips',
  weekly_4: 'weekly_chips',
}

export function StagePopover() {
  const stageInfo = useInject(FarmPlannerFactory).getStageInfo()
  const allStageIds = Object.keys(stageInfo)
  const grouped = sortBy(
    (x) => makeNumericSortable(x[0]),
    Object.entries(
      groupBy(
        (x: string) => {
          const zoneId = stageInfo[x].excel.zoneId
          if (zoneReplacement[zoneId]) return zoneReplacement[zoneId]
          return zoneId
        },
        sortBy((x) => {
          const dg = stageInfo[x].excel.diffGroup
          return makeNumericSortable(x)
        }, allStageIds),
      ),
    ),
  )
  console.log(grouped)

  return (
    <div style={{ minWidth: '200px', maxWidth: '60vw', maxHeight: '80vh', overflow: 'auto' }}>
      {grouped.map(([k, stages]) => {
        return (
          <>
            <Card style={{ padding: 15 }}>
              <h5 style={{ margin: 0, padding: 0 }}>{k}</h5>
              {stages.map((x) => {
                return <ForbiddenStageIdTag stageId={x} />
              })}
            </Card>
          </>
        )
      })}
    </div>
  )
}

export function StageButton() {
  const stageInfo = useInject(FarmPlannerFactory).getStageInfo()
  const forbiddenStageIds = useAtomValue(forbiddenStageIdsAtom)
  const allStageIds = Object.keys(stageInfo)
  const now = without(forbiddenStageIds, allStageIds).length
  const all = allStageIds.length

  return (
    <Popover2 usePortal={true} minimal={true} content={<StagePopover />} position="bottom-left">
      <Button icon={'record'} minimal={true} rightIcon={'chevron-down'}>
        关卡 {now}/{all}
      </Button>
    </Popover2>
  )
}
