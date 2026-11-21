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
import { version as lpSolverVersion } from 'javascript-lp-solver/package.json'
import { Atom, atom, useAtom, useAtomValue, useSetAtom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { sortBy } from 'ramda'
import { memo, useEffect } from 'react'
import useEvent from 'react-use-event-hook'
import { Cpp, FarmLevel, FarmLevelNames, FarmLevelShortNames, Level, useCpp, useGameAdapter } from '../Cpp'
import { useComponents } from '../hooks/useComponents'
import { useRequest } from '../hooks/useRequest'
import { FARM_PLANNER_PRECISION, FarmPlanner, IGame, IStageInfo } from '../pkg/cpp-basic'
import { FarmFailure, encodeFarmFailure } from '../pkg/cpp-basic/farmFailure'
import { UserDataAtomHolder } from '../pkg/cpp-core/UserData'
import { gt } from '../pkg/gt'
import { ErrAtom } from './Err'
import { FarmFailureState } from './FarmFailure'
import { ItemIcon } from './Icons'
import { ItemTile } from './ItemTile'
import { NoPlanState, useHasPlan } from './NoPlan'
import { PeekTrigger } from './Peek'
import { phoneAreaAtom, usePhoneLayout } from './phoneLayout'
import { formatExpectedQuantity, formatTileQuantity } from './quantity'
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

type PlanSolution = Awaited<ReturnType<FarmPlanner<IGame>['run']>>

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

/** The requirements level each farm level plans for, and the one whose plan caps its runs, planned first */
const farmLevelPlans: Record<FarmLevel, readonly [target: Level, consider?: Level]> = {
  [FarmLevel.StarOnly]: [Level.Star],
  [FarmLevel.StarForGoal]: [Level.Star, Level.Goal],
  [FarmLevel.StarForFinished]: [Level.Star, Level.Finished],
  [FarmLevel.Goal]: [Level.Goal],
  [FarmLevel.GoalForFinished]: [Level.Goal, Level.Finished],
  [FarmLevel.Finished]: [Level.Finished],
}

/** The solver found no plan, or threw */
export interface PlanFailed {
  failure: FarmFailure
  /** failure as encodeFarmFailure writes it, for the user to pass on */
  text: string
  expired: () => boolean
}

export async function plan(cpp: Cpp<IGame>, farmLevel: FarmLevel) {
  const levels = farmLevelPlans[farmLevel] as (typeof farmLevelPlans)[FarmLevel] | undefined
  if (!levels) throw new Error('Invalid farm level')
  const [target, consider] = levels
  console.log('new planning session')
  const ga = cpp.gameAdapter
  const atoms = cpp.atoms.atoms
  const store = cpp.store
  const generation = store.get(cpp.gameDataGenerationAtom)
  const dataAtomValue = store.get(atoms.dataAtom)
  const preferenceAtomValue = store.get(cpp.preferenceAtoms.preferenceAtom)
  const expired = () =>
    store.get(cpp.gameDataGenerationAtom) !== generation ||
    store.get(atoms.dataAtom) !== dataAtomValue ||
    store.get(cpp.preferenceAtoms.preferenceAtom) !== preferenceAtomValue
  const quantities = store.get(atoms.itemQuantities)
  const considerAtom = getLevelTaskRequirementsAtom(atoms, consider)
  const considerRequirements = considerAtom ? store.get(considerAtom) : undefined
  const requirements = store.get(getLevelTaskRequirementsAtom(atoms, target))
  const forbiddenFormulaTags = store.get(cpp.preferenceAtoms.forbiddenFormulaTagsAtom)
  const forbiddenStageIds = store.get(cpp.preferenceAtoms.forbiddenStageIdsAtom)

  const solve = async (
    level: Level,
    levelRequirements: Record<string, number>,
    previousResult?: PlanSolution,
  ): Promise<{ solution: PlanSolution } | { failed: PlanFailed }> => {
    const planner = await FarmPlanner.create(ga, { forbiddenFormulaTags, forbiddenStageIds }, previousResult)
    planner.setRequirements(levelRequirements)
    planner.setQuantity(quantities)
    let outcome: FarmFailure['outcome']
    try {
      const solution = await planner.run()
      if (solution.feasible) return { solution }
      outcome = { feasible: solution.feasible, bounded: solution.bounded, result: solution.result }
    } catch (e) {
      console.error(e)
      outcome = { error: e instanceof Error ? e.stack || String(e) : String(e) }
    }
    const dm = ga.getDataManager()
    const failure: FarmFailure = {
      at: new Date().toJSON(),
      game: ga.getCodename(),
      region: dm.region,
      build: __CPP_COMMIT__ ?? undefined,
      solver: { version: lpSolverVersion, precision: FARM_PLANNER_PRECISION },
      data: dm.getVersions(),
      level: farmLevel,
      failed: Level[level],
      forbiddenStageIds: [...forbiddenStageIds],
      forbiddenFormulaTags: [...forbiddenFormulaTags],
      outcome,
      previousResult,
      model: planner.getModel(),
    }
    return { failed: { failure, text: await encodeFarmFailure(failure), expired } }
  }

  let previousResult: PlanSolution | undefined
  if (consider !== undefined && considerRequirements) {
    console.log('pre-planning for consider level', Level[consider])
    const first = await solve(consider, considerRequirements)
    if ('failed' in first) return first.failed
    previousResult = first.solution
    console.log('planning for target level', Level[target], 'with previous result', previousResult)
  } else {
    console.log('planning for target level', Level[target], 'directly')
  }
  const second = await solve(target, requirements, previousResult)
  if ('failed' in second) return second.failed
  const result = second.solution

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

  return {
    target: target,
    consider: consider,
    stageRuns: sortBy((a) => -a.apCost, stageRuns),
    formulaUses,
    ap,
    unfeasibleItems: hasUnfeasibleItems ? unfeasibleItems : undefined,
    synthesisList: target === Level.Finished ? undefined : planSynthesisList(cpp, target, formulaUses),
    expired,
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
        refresh?.(level)
      }}
    />
  )
})

type DropsView = 'list' | 'tiles'

// 和 cpp_cost_materials 一样记在本机、不分档案
const dropsViewStorageAtom = atomWithStorage<unknown>('cpp_farm_drops', null, undefined, { getOnInit: true })
const dropsViewAtom = atom(
  (get): DropsView => (get(dropsViewStorageAtom) === 'tiles' ? 'tiles' : 'list'),
  (_get, set, view: DropsView) => set(dropsViewStorageAtom, view),
)

const DropsViewButton = memo(() => {
  const [view, setView] = useAtom(dropsViewAtom)
  const tiles = view === 'tiles'
  return (
    <Button
      variant="minimal"
      icon="grid-view"
      active={tiles}
      aria-pressed={tiles}
      title={gt.gettext('关卡产物显示为图标')}
      onClick={() => setView(tiles ? 'list' : 'tiles')}
    />
  )
})

const noFarmNotice = () => null

export const FarmList = memo(() => {
  const cpp = useCpp()
  const { loading, response, send, error } = useRequest(plan)
  const farmLevelAtom = cpp.preferenceAtoms.farmLevelAtom
  const farmLevel = useAtomValue(farmLevelAtom)
  const setErr = useSetAtom(ErrAtom)
  // The game component is fixed per page load, so every render calls the same hooks.
  const { useFarmNotice = noFarmNotice } = useComponents()
  const notice = useFarmNotice()
  const blocked = notice != null
  const phone = usePhoneLayout()
  const area = useAtomValue(phoneAreaAtom)
  const synthesisPane = phone && area === 'synthesis'
  const hasPlan = useHasPlan()
  const refresh = useEvent((f?: FarmLevel) => {
    if (blocked) return
    try {
      return send(cpp, f || farmLevel)
    } catch (e) {
      setErr({ error: e, context: gt.pgettext('error context', '刷本规划时遇到问题') })
    }
  })

  useAtomValue(cpp.gameDataGenerationAtom)
  useAtomValue(cpp.atoms.atoms.dataAtom)
  useAtomValue(cpp.preferenceAtoms.preferenceAtom)

  useEffect(() => {
    if (error) {
      console.log(error)
    }
  }, [error])

  // Runs again when the notice goes away, such as after its 重试, and plans then.
  useEffect(() => {
    if (blocked) return
    const i = setTimeout(refresh, 1000)
    return () => clearTimeout(i)
  }, [blocked, refresh])

  const expired = response && response.expired()
  useEffect(() => {
    if (expired && !blocked) {
      const i = setTimeout(refresh, 1000)
      return () => clearTimeout(i)
    }
  }, [blocked, expired, refresh])

  return (
    <>
      <Navbar style={{ paddingLeft: '0.5em', paddingRight: '0.5em' }}>
        <Navbar.Group align={Alignment.RIGHT}>
          {synthesisPane ? null : <DropsViewButton />}
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
            <Button
              variant="minimal"
              endIcon={<Icon size={10} icon="chevron-down" />}
              size="small"
              style={{ marginRight: -5 }}
            >
              {FarmLevelShortNames[farmLevel].toString()}
            </Button>
          </Popover>
          <Button
            icon={loading ? <Spinner size={16} /> : 'refresh'}
            variant="minimal"
            disabled={loading || blocked}
            onClick={() => refresh()}
          />
        </Navbar.Group>
        <Navbar.Group align={Alignment.LEFT}>
          {response && !('failure' in response) && !blocked ? (
            <ValueTag value={response.ap} intent={'primary'} />
          ) : null}
        </Navbar.Group>
      </Navbar>
      <div
        className="cpp-farm-body"
        data-pane={synthesisPane ? 'synthesis' : 'stages'}
        style={{ opacity: expired && !blocked ? 0.5 : undefined }}
      >
        {blocked ? (
          notice
        ) : response && 'failure' in response ? (
          <FarmFailureState failed={response} />
        ) : response ? (
          <>
            <div className="bp6-elevation-1 cpp-farm-stages">
              {/* At 毕业 the stages cover every operator, with a plan or without */}
              {hasPlan || response.stageRuns.length > 0 || response.unfeasibleItems ? (
                <Menu>
                  {response.stageRuns.map((run) => (
                    <StageLine run={run} key={run.stageId} />
                  ))}
                  {response.unfeasibleItems ? <UnfeasibleLine items={response.unfeasibleItems} /> : null}
                </Menu>
              ) : (
                <NoPlanState icon="map" />
              )}
            </div>
            {!response.synthesisList ? (
              <div className="bp6-elevation-1 cpp-farm-synthesis">
                <NonIdealState title={gt.gettext('暂不支持计算毕业合成')} icon="warning-sign" />
              </div>
            ) : (
              <Menu className="bp6-elevation-1 cpp-farm-synthesis">
                <SynthesisList data={response.synthesisList} />
              </Menu>
            )}
          </>
        ) : response === undefined ? (
          <NonIdealState title={gt.gettext('请稍候')} icon={<Spinner />} />
        ) : null}
      </div>
    </>
  )
})

export const StageLine = memo(({ run }: { run: StageRun }) => {
  const samples = Math.max(
    -Infinity,
    ...Object.values(run.stage.dropInfo)
      .map((x) => x[1])
      .filter((x) => Number.isFinite(x)),
  )

  return (
    <>
      <PeekTrigger
        peek={{ kind: 'stage', id: run.stageId }}
        renderTarget={(peek) => (
          <MenuItem
            {...peek}
            className={peek ? peek.className : 'cpp-menu-not-interactive'}
            tabIndex={peek ? 0 : -1}
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
                  <span style={{ display: 'inline-flex', gap: 4 }}>
                    <ValueTag value={run.stage.ap} minimal={true} intent={'primary'} />
                    {Number.isFinite(samples) ? <SampleTag minimal sample={samples} /> : ''}
                  </span>
                </div>
              </>
            }
          />
        )}
      />
      {/* The plan's own stage: an event may have ended in the newer data, and the plan is redone only a second later */}
      <Drops
        drops={run.stage.sortedDropInfo.map(([k, v, z]) => [k, (Number.isFinite(z) ? v / z : v) * run.count] as const)}
      />
      <MenuDivider />
    </>
  )
})

export const UnfeasibleLine = memo(({ items }: { items: Record<string, number> }) => {
  return (
    <>
      <MenuItem className="cpp-menu-not-interactive" tabIndex={-1} text={gt.gettext('暂无可计算来源')} />
      <Drops drops={Object.entries(items)} />
      <MenuDivider />
    </>
  )
})

/** 一组物品和数量：一样一行，或者按 dropsViewAtom 收成一排格子 */
const Drops = ({ drops }: { drops: readonly (readonly [itemId: string, quantity: number])[] }) => {
  const ga = useGameAdapter()
  const view = useAtomValue(dropsViewAtom)

  if (view === 'tiles') {
    return (
      <li role="none" className="cpp-farm-drop-tiles">
        <div className="cpp-item-tiles">
          {drops.map(([k, quantity]) => {
            const item = ga.getItem(k)
            return (
              <ItemTile
                key={k}
                id={k}
                item={item}
                label={formatTileQuantity(quantity)}
                title={`${item.name} × ${formatExpectedQuantity(quantity)}`}
              />
            )
          })}
        </div>
      </li>
    )
  }

  return (
    <>
      {drops.map(([k, quantity]) => {
        const item = ga.getItem(k)
        return (
          <PeekTrigger
            key={k}
            peek={{ kind: 'item', id: k }}
            renderTarget={(peek) => (
              <MenuItem
                {...peek}
                style={{ fontWeight: 'normal' }}
                className={peek ? peek.className : 'cpp-menu-not-interactive'}
                icon={<ItemIcon item={item} size={20} />}
                text={
                  <>
                    <span>{item.name}</span>
                    <span style={{ float: 'right' }}>{formatExpectedQuantity(quantity)}</span>
                  </>
                }
              />
            )}
          />
        )
      })}
    </>
  )
}
