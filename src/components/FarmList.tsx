import { Alignment, Button, Menu, MenuDivider, MenuItem, Navbar, Spinner, Tag } from '@blueprintjs/core'
import { sortBy } from 'ramda'
import { useCallback, useEffect } from 'react'
import { Cpp, useAtoms, useCpp, useGameAdapter, useStore } from '../Cpp'
import { useRequest } from '../hooks/useRequest'
import { FarmPlanner, IGame, IStageInfo } from '../pkg/cpp-basic'
import { CachedImg } from './Icons'
import { ValueTag } from './Value'

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
  for (const [k, v] of Object.entries(result)) {
    if (k.startsWith('battle:')) {
      const stageId = k.slice('battle:'.length)
      const stage = stageInfo[stageId]
      const count = Math.ceil(Number(v || 0))
      stageRuns.push({ stageId, stage, count, apCost: count * stage.ap })
      ap += count * stage.ap
    }
  }

  return { stageRuns: sortBy((a) => -a.apCost, stageRuns), ap }
}

export function FarmList() {
  const cpp = useCpp()
  const { loading, response, send, error } = useRequest(plan)
  const refresh = useCallback(() => send(cpp, false), [cpp, send])
  const refreshAll = useCallback(() => send(cpp, true), [cpp, send])
  useEffect(() => {
    if (error) {
      console.log(error)
    }
  }, [error])

  useEffect(() => {
    const i = setTimeout(refresh, 1000)
    return () => clearTimeout(i)
  }, [])

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
        <Navbar.Group align={Alignment.LEFT}>{response ? <ValueTag value={response.ap} /> : '刷什么'}</Navbar.Group>
      </Navbar>
      <Menu style={{ flex: 1, flexShrink: 1, overflow: 'auto' }}>
        {response?.stageRuns.map((run) => (
          <StageLine run={run} key={run.stageId} />
        ))}
      </Menu>
    </>
  )
}

export function StageLine({ run }: { run: StageRun }) {
  const ga = useGameAdapter()
  const stageInfo = ga.getStageInfos()[run.stageId]

  return (
    <>
      <MenuItem
        title={run.stageId}
        text={
          <>
            <span style={{ float: 'right', display: 'inline-flex' }}>
              <ValueTag value={run.apCost} minimal={true} />
            </span>
            <span style={{ display: 'inline-flex' }}>
              <Tag>
                <code style={{ fontSize: '110%' }}>{run.stage.code}</code>
              </Tag>
              {`×${run.count}`}
            </span>
          </>
        }
      ></MenuItem>
      {stageInfo.sortedDropInfo.map(([k, v]) => {
        const item = ga.getItem(k)
        return (
          <MenuItem
            key={k}
            style={{ fontWeight: 'normal' }}
            icon={<CachedImg src={item.icon} width={'100%'} height={'100%'} alt={item.key} title={item.key} />}
            text={
              <>
                <span>{item.name}</span>
                <span style={{ float: 'right' }}>{(v * run.count).toFixed(2).replace(/\.?0+$/, '')}</span>
              </>
            }
          />
        )
      })}
      <MenuDivider />
    </>
  )
}
