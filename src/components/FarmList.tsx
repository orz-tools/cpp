import { Alignment, Button, Icon, Menu, MenuDivider, MenuItem, Navbar, Popover, Spinner, Tag } from '@blueprintjs/core'
import { Atom, useAtom, useAtomValue, useSetAtom } from 'jotai'
import { sortBy } from 'ramda'
import { memo, useEffect } from 'react'
import useEvent from 'react-use-event-hook'
import { Cpp, FarmLevel, FarmLevelNames, FarmLevelShortNames, useCpp, useGameAdapter } from '../Cpp'
import { useRequest } from '../hooks/useRequest'
import { FarmPlanner, IGame, IStageInfo } from '../pkg/cpp-basic'
import { UserDataAtomHolder } from '../pkg/cpp-core/UserData'
import { ErrAtom } from './Err'
import { CachedImg } from './Icons'
import { SampleTag, ValueTag } from './Value'

interface StageRun {
  stageId: string
  stage: IStageInfo
  count: number
  apCost: number
}

enum Level {
  Star = 1,
  Goal = 2,
  Finished = 3,
}

function getLevelTaskRequirementsAtom(atoms: UserDataAtomHolder<IGame>['atoms'], l: Level): Atom<Record<string, number>>

function getLevelTaskRequirementsAtom(
  atoms: UserDataAtomHolder<IGame>['atoms'],
  l: Level | undefined,
): Atom<Record<string, number>> | undefined

function getLevelTaskRequirementsAtom(atoms: UserDataAtomHolder<IGame>['atoms'], l: Level | undefined) {
  if (l === undefined) return undefined
  switch (l) {
    case Level.Star:
      throw new Error('Star level not implemented')
    case Level.Goal:
      return atoms.allGoalTaskRequirements
    case Level.Finished:
      return atoms.allFinishedTaskRequirements
  }
  throw new Error('invalid level')
}

export async function plan(cpp: Cpp<IGame>, target: Level, consider?: Level) {
  console.log('new planning session')
  const ga = cpp.gameAdapter
  const atoms = cpp.atoms.atoms
  const store = cpp.store
  const quantities = store.get(atoms.itemQuantities)
  const considerAtom = getLevelTaskRequirementsAtom(atoms, consider)
  const considerRequirements = considerAtom ? store.get(considerAtom) : undefined
  const requirements = store.get(getLevelTaskRequirementsAtom(atoms, target))
  const forbiddenFormulaTags = store.get(cpp.preferenceAtoms.forbiddenFormulaTagsAtom)
  const forbiddenStageIds = store.get(cpp.preferenceAtoms.forbiddenStageIdsAtom)

  const previousResult = considerRequirements
    ? await (async () => {
        console.log('pre-planning for consider level', Level[consider!])
        const planner = await FarmPlanner.create(ga, { forbiddenFormulaTags, forbiddenStageIds })
        planner.setRequirements(considerRequirements)
        planner.setQuantity(quantities)
        const result = await planner.run()
        if (!result.feasible) {
          return null
        }
        return result
      })()
    : undefined
  if (previousResult === null) return null

  if (previousResult) {
    console.log('planning for target level', Level[target], 'with previous result', previousResult)
  } else {
    console.log('planning for target level', Level[target], 'directly')
  }
  const planner = await FarmPlanner.create(ga, { forbiddenFormulaTags, forbiddenStageIds }, previousResult)
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
    target: target,
    consider: consider,
    stageRuns: sortBy((a) => -a.apCost, stageRuns),
    ap,
    unfeasibleItems: hasUnfeasibleItems ? unfeasibleItems : undefined,
  }
}

const FarmLevelButton = memo(({ level, refresh }: { level: FarmLevel; refresh?: (level: FarmLevel) => any }) => {
  const cpp = useCpp()
  const farmLevelAtom = cpp.preferenceAtoms.farmLevelAtom
  const [farmLevel, setFarmLevel] = useAtom(farmLevelAtom)
  return (
    <MenuItem
      text={FarmLevelNames[level]}
      active={farmLevel === level}
      onClick={() => {
        setFarmLevel(level)
        refresh && refresh(level)
      }}
    />
  )
})

export const FarmList = memo(() => {
  const cpp = useCpp()
  const { loading, response, send, error } = useRequest(plan)
  const farmLevelAtom = cpp.preferenceAtoms.farmLevelAtom
  const farmLevel = useAtomValue(farmLevelAtom)
  const setErr = useSetAtom(ErrAtom)
  const refresh = useEvent((f?: FarmLevel) => {
    if (!f) f = farmLevel
    try {
      switch (f) {
        case FarmLevel.Finished:
          return send(cpp, Level.Finished)
        case FarmLevel.Goal:
          return send(cpp, Level.Goal)
        case FarmLevel.GoalForFinished:
          return send(cpp, Level.Goal, Level.Finished)
      }
      throw new Error('Invalid farm level')
    } catch (e) {
      setErr({ error: e, context: '刷本规划时遇到问题' })
    }
  })
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
          <Popover
            usePortal={true}
            minimal={true}
            content={
              <Menu>
                <FarmLevelButton level={FarmLevel.Goal} refresh={refresh} />
                <FarmLevelButton level={FarmLevel.GoalForFinished} refresh={refresh} />
                <MenuDivider />
                <FarmLevelButton level={FarmLevel.Finished} refresh={refresh} />
              </Menu>
            }
            position="bottom-right"
          >
            <Button minimal={true} rightIcon={<Icon size={10} icon="chevron-down" />} small style={{ marginRight: -5 }}>
              {FarmLevelShortNames[farmLevel]}
            </Button>
          </Popover>
          <Button
            icon={loading ? <Spinner size={16} /> : 'refresh'}
            minimal={true}
            disabled={loading}
            onClick={() => refresh()}
          />
        </Navbar.Group>
        <Navbar.Group align={Alignment.LEFT}>
          {response ? <ValueTag value={response.ap} intent={'primary'} /> : null}
        </Navbar.Group>
      </Navbar>
      <Menu style={{ flex: 1, flexShrink: 1, overflow: 'auto' }}>
        {response?.stageRuns.map((run) => <StageLine run={run} key={run.stageId} />)}
        {response?.unfeasibleItems ? <UnfeasibleLine items={response.unfeasibleItems} /> : null}
      </Menu>
    </>
  )
})

export const StageLine = memo(({ run }: { run: StageRun }) => {
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
})

export const UnfeasibleLine = memo(({ items }: { items: Record<string, number> }) => {
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
})
