import { Button, Card, Checkbox, Menu, MenuItem, Popover } from '@blueprintjs/core'
import { useAtom, useAtomValue } from 'jotai'
import { groupBy, sortBy, without } from 'ramda'
import React, { memo } from 'react'
import { useAtoms, useCpp, useGameAdapter } from '../Cpp'
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
            return <ForbiddenFormulaTag key={k} tag={k} text={v} />
          })}
        </Menu>
      }
      position="bottom-left"
    >
      <Button icon={'properties'} minimal={true} rightIcon={'chevron-down'}>
        选项
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
      <Button icon={'layers'} minimal={true} rightIcon={'chevron-down'}>
        关卡 {now}/{all}
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
    <Button icon={'image-rotate-right'} minimal={true} active={blobFlavour === 'normal'} onClick={handleClick}>
      加载版权素材
    </Button>
  )
})

export const MaybeSoulButton = memo(() => {
  const cpp = useCpp()
  const blobFlavour = useAtomValue(cpp.preferenceAtoms.blobFlavourAtom)
  const flavours = cpp.gameComponent.blobFlavours
  const shouldShow = flavours?.length === 1 && blobFlavour === flavours[0] ? false : true
  return shouldShow ? <SoulButton /> : null
})
