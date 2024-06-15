import {
  Alignment,
  Button,
  Icon,
  Menu,
  MenuDivider,
  MenuItem,
  Navbar,
  NonIdealState,
  Popover,
  Spinner,
  Tag,
} from '@blueprintjs/core'
import { Atom, useAtom, useAtomValue, useSetAtom } from 'jotai'
import { sortBy } from 'ramda'
import { memo, useEffect } from 'react'
import useEvent from 'react-use-event-hook'
import { Cpp, FarmLevel, FarmLevelNames, FarmLevelShortNames, Level, useCpp, useGameAdapter } from '../Cpp'
import { useRequest } from '../hooks/useRequest'
import { FarmPlanner, IGame, IStageInfo } from '../pkg/cpp-basic'
import { UserDataAtomHolder } from '../pkg/cpp-core/UserData'
import { gt } from '../pkg/gt'
import { ErrAtom } from './Err'
import { ItemIcon } from './Icons'
import { SynthesisList, planSynthesisList } from './SynthesisList'
import { SampleTag, ValueTag } from './Value'

interface StageRun {
  stageId: string
  stage: IStageInfo
  count: number
  apCost: number
}

export interface FormulaUse {
  formulaId: string
  times: number
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
      return atoms.allStarredTaskRequirements
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
  const formulaUses: FormulaUse[] = []
  const unfeasibleItems: Record<string, number> = Object.create(null)
  let hasUnfeasibleItems = false
  for (const [k, v] of Object.entries(result)) {
    if (k.startsWith('battle:')) {
      const stageId = k.slice('battle:'.length)
      const stage = stageInfo[stageId]
      const count = Math.ceil(Number(v || 0))
      stageRuns.push({ stageId, stage, count, apCost: count * stage.ap })
      ap += count * stage.ap
    } else if (k.startsWith('formula:')) {
      const formulaId = k.slice('formula:'.length)
      const count = Math.floor(Number(v || 0))
      formulaUses.push({ formulaId, times: count })
    } else if (k.startsWith('unfeasible:item:')) {
      const itemId = k.slice('unfeasible:item:'.length)
      const count = Math.ceil(Number(v || 0))
      unfeasibleItems[itemId] = count
      hasUnfeasibleItems = true
    }
  }

  const dataAtomValue = store.get(atoms.dataAtom)
  const preferenceAtomValue = store.get(cpp.preferenceAtoms.preferenceAtom)

  return {
    target: target,
    consider: consider,
    stageRuns: sortBy((a) => -a.apCost, stageRuns),
    formulaUses,
    ap,
    unfeasibleItems: hasUnfeasibleItems ? unfeasibleItems : undefined,
    synthesisList: target === Level.Finished ? undefined : planSynthesisList(cpp, target, formulaUses),
    expired: () => {
      return (
        store.get(atoms.dataAtom) !== dataAtomValue ||
        store.get(cpp.preferenceAtoms.preferenceAtom) !== preferenceAtomValue
      )
    },
  }
}

const FarmLevelButton = memo(({ level, refresh }: { level: FarmLevel; refresh?: (level: FarmLevel) => any }) => {
  const cpp = useCpp()
  const farmLevelAtom = cpp.preferenceAtoms.farmLevelAtom
  const [farmLevel, setFarmLevel] = useAtom(farmLevelAtom)
  return (
    <MenuItem
      text={FarmLevelNames[level].toString()}
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
        case FarmLevel.StarOnly:
          return send(cpp, Level.Star)
        case FarmLevel.StarForGoal:
          return send(cpp, Level.Star, Level.Goal)
        case FarmLevel.StarForFinished:
          return send(cpp, Level.Star, Level.Finished)
      }
      throw new Error('Invalid farm level')
    } catch (e) {
      setErr({ error: e, context: gt.pgettext('error context', '刷本规划时遇到问题') })
    }
  })

  useAtomValue(cpp.atoms.atoms.dataAtom)
  useAtomValue(cpp.preferenceAtoms.preferenceAtom)

  useEffect(() => {
    if (error) {
      console.log(error)
    }
  }, [error])

  useEffect(() => {
    const i = setTimeout(refresh, 1000)
    return () => clearTimeout(i)
  }, [refresh])

  const expired = response && response.expired()
  useEffect(() => {
    if (expired) {
      const i = setTimeout(refresh, 1000)
      return () => clearTimeout(i)
    }
  }, [expired, refresh])

  return (
    <>
      <Navbar>
        <Navbar.Group align={Alignment.RIGHT}>
          <Popover
            usePortal={true}
            minimal={true}
            content={
              <Menu>
                <FarmLevelButton level={FarmLevel.StarOnly} refresh={refresh} />
                <FarmLevelButton level={FarmLevel.StarForGoal} refresh={refresh} />
                <FarmLevelButton level={FarmLevel.StarForFinished} refresh={refresh} />
                <MenuDivider />
                <FarmLevelButton level={FarmLevel.Goal} refresh={refresh} />
                <FarmLevelButton level={FarmLevel.GoalForFinished} refresh={refresh} />
                <MenuDivider />
                <FarmLevelButton level={FarmLevel.Finished} refresh={refresh} />
              </Menu>
            }
            position="bottom-right"
          >
            <Button minimal={true} rightIcon={<Icon size={10} icon="chevron-down" />} small style={{ marginRight: -5 }}>
              {FarmLevelShortNames[farmLevel].toString()}
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
      <div
        style={{
          display: 'flex',
          flex: 1,
          flexShrink: 1,
          overflow: 'auto',
          opacity: expired ? 0.5 : undefined,
        }}
      >
        {response ? (
          <>
            <Menu className="bp5-elevation-1" style={{ width: 250, overflow: 'auto' }}>
              {response.stageRuns.map((run) => (
                <StageLine run={run} key={run.stageId} />
              ))}
              {response.unfeasibleItems ? <UnfeasibleLine items={response.unfeasibleItems} /> : null}
            </Menu>
            {!response.synthesisList ? (
              <div className="bp5-elevation-1" style={{ flex: 1, flexShrink: 1, overflow: 'auto' }}>
                <NonIdealState title={gt.gettext('暂不支持计算毕业合成')} icon="warning-sign" />
              </div>
            ) : (
              <Menu className="bp5-elevation-1" style={{ flex: 1, flexShrink: 1, overflow: 'auto' }}>
                <SynthesisList data={response.synthesisList} refresh={refresh} />
              </Menu>
            )}
          </>
        ) : response === null ? (
          <NonIdealState title={gt.gettext('线性规划失败')} icon="error" />
        ) : response === undefined ? (
          <NonIdealState title={gt.gettext('请稍候')} icon={<Spinner />} />
        ) : null}
      </div>
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
            icon={<ItemIcon item={item} size={20} />}
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
      <MenuItem text={gt.gettext('暂无可计算来源')} />
      {Object.entries(items).map(([k, v]) => {
        const item = ga.getItem(k)
        const value = v
        return (
          <MenuItem
            className="cpp-menu-not-interactive"
            key={k}
            style={{ fontWeight: 'normal' }}
            icon={<ItemIcon item={item} size={20} />}
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
