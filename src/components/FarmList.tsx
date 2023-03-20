import { Alignment, Button, Icon, Menu, MenuDivider, MenuItem, Navbar, Spinner, Tag } from '@blueprintjs/core'
import target from '@blueprintjs/icons/lib/esm/generated-icons/16px/paths/target'
import { sortBy } from 'ramda'
import { useCallback, useEffect } from 'react'
import { useContainer, useInject } from '../hooks/useContainer'
import { useRequest } from '../hooks/useRequest'
import { Container } from '../pkg/container'
import { DataManager } from '../pkg/cpp-core/DataManager'
import { ExcelStageTable } from '../pkg/cpp-core/excelTypes'
import { FarmPlannerFactory } from '../pkg/cpp-core/FarmPlanner'
import { UserDataAtomHolder } from '../pkg/cpp-core/UserData'
import { Store } from '../Store'
import { CachedImg } from './Icons'
import { ValueTag } from './Value'

interface StageRun {
  stageId: string
  stage: ExcelStageTable.Stage
  count: number
  apCost: number
}

/*factory: FarmPlannerFactory, requirements: Record<string, number>, quantity: Record<string, number>*/
export async function plan(container: Container) {
  const factory = container.get(FarmPlannerFactory)
  const dm = container.get(DataManager)
  const atoms = container.get(UserDataAtomHolder)
  const store = container.get(Store).store
  const quantities = store.get(atoms.itemQuantities)
  const requirements = store.get(atoms.allGoalTaskRequirements)
  const forbiddenFormulaTags = store.get(atoms.forbiddenFormulaTagsAtom)
  const planner = await factory.build({ forbiddenFormulaTags })
  planner.setRequirements(requirements)
  planner.setQuantity(quantities)
  const result = await planner.run()
  if (!result.feasible) {
    return null
  }

  let ap = 0
  const stageRuns: StageRun[] = []
  for (const [k, v] of Object.entries(result)) {
    if (k.startsWith('battle:')) {
      const stageId = k.slice('battle:'.length)
      const stage = dm.raw.exStage.stages[stageId]
      const count = Math.ceil(Number(v || 0))
      stageRuns.push({ stageId, stage, count, apCost: count * stage.apCost })
      ap += count * stage.apCost
    }
  }

  return { stageRuns: sortBy((a) => -a.apCost, stageRuns), ap }
}

export function FarmList() {
  const container = useContainer()
  const { loading, response, send, error } = useRequest(plan)
  const refresh = useCallback(() => send(container), [container, send])
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
  const stageInfo = useInject(FarmPlannerFactory).getStageInfo()[run.stageId]
  const dm = useInject(DataManager)

  return (
    <>
      <MenuItem
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
        const item = dm.data.items[k]
        return (
          <MenuItem
            key={k}
            style={{ fontWeight: 'normal' }}
            icon={<CachedImg src={item.icon} width={'100%'} height={'100%'} alt={item.key} title={item.key} />}
            text={
              <>
                <span>{item.raw.name}</span>
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
