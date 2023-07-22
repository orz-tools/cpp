import { Alignment, Button, Menu, MenuDivider, MenuItem, Navbar, Spinner, Tag } from '@blueprintjs/core'
import { sortBy } from 'ramda'
import { useEffect } from 'react'
import useEvent from 'react-use-event-hook'
import { Cpp, useCpp, useGameAdapter } from '../Cpp'
import { useRequest } from '../hooks/useRequest'
import { FarmPlanner, IGame, IStageInfo } from '../pkg/cpp-basic'
import { CachedImg } from './Icons'
import { SampleTag, ValueTag } from './Value'

interface StageRun {
  stageId: string
  stage: IStageInfo
  count: number
  apCost: number
}

export async function plan(cpp: Cpp<IGame>, finished: boolean) {
  const ga = cpp.gameAdapter
  const atoms = cpp.atoms.atoms
  const store = cpp.store
  const quantities = store.get(atoms.itemQuantities)
  const requirements = store.get(finished ? atoms.allFinishedTaskRequirements : atoms.allGoalTaskRequirements)
  const forbiddenFormulaTags = store.get(cpp.preferenceAtoms.forbiddenFormulaTagsAtom)
  const forbiddenStageIds = store.get(cpp.preferenceAtoms.forbiddenStageIdsAtom)
  const planner = await FarmPlanner.create(ga, { forbiddenFormulaTags, forbiddenStageIds })
  planner.setRequirements(requirements)
  planner.setQuantity(quantities)
  const result = await planner.run()
  if (!result.feasible) {
    return null
  }

  let ap = 0
  const stageInfo = ga.getStageInfos()
  const stageRuns: StageRun[] = []
  const unfeasibleItems: Record<string, number> = Object.create(null)
  let hasUnfeasibleItems = false
  for (const [k, v] of Object.entries(result)) {
    if (k.startsWith('battle:')) {
      const stageId = k.slice('battle:'.length)
      const stage = stageInfo[stageId]
      const count = Math.ceil(Number(v || 0))
      stageRuns.push({ stageId, stage, count, apCost: count * stage.ap })
      ap += count * stage.ap
    } else if (k.startsWith('unfeasible:item:')) {
      const itemId = k.slice('unfeasible:item:'.length)
      const count = Math.ceil(Number(v || 0))
      unfeasibleItems[itemId] = count
      hasUnfeasibleItems = true
    }
  }

  return {
    stageRuns: sortBy((a) => -a.apCost, stageRuns),
    ap,
    unfeasibleItems: hasUnfeasibleItems ? unfeasibleItems : undefined,
  }
}

export function FarmList() {
  const cpp = useCpp()
  const { loading, response, send, error } = useRequest(plan)
  const refresh = useEvent(() => send(cpp, false))
  const refreshAll = useEvent(() => send(cpp, true))
  useEffect(() => {
    if (error) {
      console.log(error)
    }
  }, [error])

  useEffect(() => {
    const i = setTimeout(refresh, 1000)
    return () => clearTimeout(i)
  }, [refresh])

  return (
    <>
      <Navbar>
        <Navbar.Group align={Alignment.RIGHT}>
          <Button text={''} minimal={true} disabled={loading} onClick={refreshAll} />
          <Button
            icon={loading ? <Spinner size={16} /> : 'refresh'}
            minimal={true}
            disabled={loading}
            onClick={refresh}
          />
        </Navbar.Group>
        <Navbar.Group align={Alignment.LEFT}>
          {response ? <ValueTag value={response.ap} intent={'primary'} /> : '刷什么'}
        </Navbar.Group>
      </Navbar>
      <Menu style={{ flex: 1, flexShrink: 1, overflow: 'auto' }}>
        {response?.stageRuns.map((run) => (
          <StageLine run={run} key={run.stageId} />
        ))}
        {response?.unfeasibleItems ? <UnfeasibleLine items={response.unfeasibleItems} /> : null}
      </Menu>
    </>
  )
}

export function StageLine({ run }: { run: StageRun }) {
  const ga = useGameAdapter()
  const stageInfo = ga.getStageInfos()[run.stageId]
  const samples = Math.max(
    -Infinity,
    ...Object.values(run.stage.dropInfo)
      .map((x) => x[1])
      .filter((x) => Number.isFinite(x)),
  )

  return (
    <>
      <MenuItem
        title={run.stageId}
        text={
          <>
            <div>
              <span style={{ float: 'right', display: 'inline-flex' }}>
                <ValueTag value={run.apCost} minimal={true} intent={'primary'} />
              </span>
              <span style={{ display: 'inline-flex' }}>
                <Tag>
                  <code style={{ fontSize: '110%' }}>{run.stage.code}</code>
                </Tag>
                {`×${run.count}`}
              </span>
            </div>
            <div style={{ marginTop: '0.5em' }}>
              <span style={{ display: 'inline-flex' }}>
                <ValueTag value={run.stage.ap} minimal={true} intent={'primary'} />
                {Number.isFinite(samples) ? <SampleTag minimal sample={samples} /> : ''}
              </span>
            </div>
          </>
        }
      />
      {stageInfo.sortedDropInfo.map(([k, v, z]) => {
        const item = ga.getItem(k)
        const value = Number.isFinite(z) ? v / z : v
        return (
          <MenuItem
            key={k}
            style={{ fontWeight: 'normal' }}
            className="cpp-menu-not-interactive"
            icon={
              <CachedImg
                src={item.icon}
                width={'20'}
                height={'20'}
                alt={item.key}
                title={item.key}
                className="cpp-item-icon"
              />
            }
            text={
              <>
                <span>{item.name}</span>
                <span style={{ float: 'right' }}>{(value * run.count).toFixed(2).replace(/\.?0+$/, '')}</span>
              </>
            }
          />
        )
      })}
      <MenuDivider />
    </>
  )
}

export function UnfeasibleLine({ items }: { items: Record<string, number> }) {
  const ga = useGameAdapter()

  return (
    <>
      <MenuItem text={'暂无可计算来源'} />
      {Object.entries(items).map(([k, v]) => {
        const item = ga.getItem(k)
        const value = v
        return (
          <MenuItem
            className="cpp-menu-not-interactive"
            key={k}
            style={{ fontWeight: 'normal' }}
            icon={
              <CachedImg
                src={item.icon}
                width={'20'}
                height={'20'}
                alt={item.key}
                title={item.key}
                className="cpp-item-icon"
              />
            }
            text={
              <>
                <span>{item.name}</span>
                <span style={{ float: 'right' }}>{value.toFixed(2).replace(/\.?0+$/, '')}</span>
              </>
            }
          />
        )
      })}
      <MenuDivider />
    </>
  )
}
