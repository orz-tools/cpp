import { clone, intersection, sum } from 'ramda'
import { IGame, IGameAdapter, Task } from '../cpp-basic'

export enum TaskStatus {
  Completable,
  Synthesizable,
  DependencyUnmet,
  AllUnmet,
  Manually,
}

export enum TaskCostStatus {
  Completable,
  Synthesizable,
  AllUnmet,
}

export interface TaskExtra {
  status: TaskStatus
  costStatus: TaskCostStatus[]
  quantityCanConsume: number[]
  costSynthesised: number[]
  valueTotal: number[]
  valueFulfilled: number[]
}

export const emptyTaskExtra: TaskExtra = {
  status: TaskStatus.AllUnmet,
  costStatus: [],
  quantityCanConsume: [],
  costSynthesised: [],
  valueTotal: [],
  valueFulfilled: [],
}

export function sortTask(tasks: Task<any>[]) {
  return tasks
}

export function generateTaskExtra<G extends IGame>(
  ga: IGameAdapter<G>,
  tasks: Task<G>[],
  forbiddenFormulaTags: string[],
  itemQuantities: Record<string, number>,
): [Task<G>, TaskExtra][] {
  const allExpItems = ga.getExpItems()
  let quantities = clone(itemQuantities)

  const consumeItems = (
    inputCosts: { itemId: string; quantity: number }[],
  ): {
    result: boolean | undefined
    newQuantities?: Record<string, number>
    costStatus: TaskCostStatus[]
    quantityCanConsume: number[]
    costSynthesised: number[]
    valueTotal: number[]
    valueFulfilled: number[]
  } => {
    const costStatus: TaskCostStatus[] = new Array(inputCosts.length).fill(TaskCostStatus.Completable)
    const quantityCanConsume: number[] = new Array(inputCosts.length).fill(0)
    const costSynthesised: number[] = new Array(inputCosts.length).fill(0)
    const valueTotal: number[] = new Array(inputCosts.length).fill(0)
    const valueFulfilled: number[] = new Array(inputCosts.length).fill(0)
    let needSynthesis: boolean | undefined = false
    const newQuantities = clone(quantities)
    const queue: { itemId: string; quantity: number; source: number; root: boolean }[] = inputCosts.map((x, i) => ({
      ...x,
      source: i,
      root: true,
    }))
    while (queue.length > 0) {
      const cost = queue.shift()!
      // if (cost.itemId !== ITEM_VIRTUAL_EXP) {
      const quantity = newQuantities[cost.itemId] || 0
      if (quantity >= cost.quantity) {
        if (cost.root) {
          quantityCanConsume[cost.source] += quantity
        }
        valueTotal[cost.source] += (ga.getItem(cost.itemId).valueAsAp || 0) * cost.quantity
        valueFulfilled[cost.source] += (ga.getItem(cost.itemId).valueAsAp || 0) * cost.quantity
        newQuantities[cost.itemId] = quantity - cost.quantity
      } else {
        const left = cost.quantity - quantity
        if (quantity > 0) {
          if (cost.root) {
            quantityCanConsume[cost.source] += quantity
          }
          valueTotal[cost.source] += (ga.getItem(cost.itemId).valueAsAp || 0) * quantity
          valueFulfilled[cost.source] += (ga.getItem(cost.itemId).valueAsAp || 0) * quantity
          newQuantities[cost.itemId] = 0
        }

        const formula = ga
          .getFormulas()
          .find((x) => x.itemId === cost.itemId && intersection(forbiddenFormulaTags || [], x.tags || []).length === 0)
        if (formula) {
          if (cost.root) {
            costSynthesised[cost.source] += left
          }
          if (needSynthesis === false) {
            needSynthesis = true
          }
          if (costStatus[cost.source] === TaskCostStatus.Completable) {
            costStatus[cost.source] = TaskCostStatus.Synthesizable
          }
          const times = Math.ceil(left / formula.quantity)
          const extra = times * formula.quantity - left
          newQuantities[cost.itemId] = (newQuantities[cost.itemId] || 0) + extra
          for (const formulaCost of formula.costs) {
            queue.push({
              itemId: formulaCost.itemId,
              quantity: formulaCost.quantity * times,
              source: cost.source,
              root: false,
            })
          }
        } else if (Object.prototype.hasOwnProperty.call(allExpItems, cost.itemId)) {
          const thisExpItem = allExpItems[cost.itemId]
          if (cost.root) {
            quantityCanConsume[cost.source] += sum(
              Object.entries(thisExpItem.value).map(([id, exp]) => (newQuantities[id] || 0) * exp),
            )
          }
          let exp = cost.quantity
          valueTotal[cost.source] += (ga.getItem(cost.itemId).valueAsAp || 0) * exp
          const expItems = Object.entries(thisExpItem.value).sort((a, b) => -a[1] + b[1])
          for (const expItem_ of expItems) {
            const expItem = { id: expItem_[0], gainExp: expItem_[1] }
            if (!newQuantities[expItem.id]) continue
            const need = Math.min(newQuantities[expItem.id], Math.floor(exp / expItem.gainExp))
            exp -= need * expItem.gainExp
            valueFulfilled[cost.source] += (ga.getItem(expItem.id).valueAsAp || 0) * need
            newQuantities[expItem.id] = newQuantities[expItem.id] - need
          }
          const smallestExpItemWithQuantity = expItems.reverse().find((x) => newQuantities[x[0]] > 0)
          if (exp === 0) {
            //
          } else if (smallestExpItemWithQuantity && exp <= smallestExpItemWithQuantity[1]) {
            exp = 0
            valueFulfilled[cost.source] += (ga.getItem(smallestExpItemWithQuantity[0]).valueAsAp || 0) * 1
            newQuantities[smallestExpItemWithQuantity[0]] -= 1
          } else {
            needSynthesis = undefined
            costStatus[cost.source] = TaskCostStatus.AllUnmet
          }
        } else {
          valueTotal[cost.source] += (ga.getItem(cost.itemId).valueAsAp || 0) * left
          // continue for task cost status
          needSynthesis = undefined
          costStatus[cost.source] = TaskCostStatus.AllUnmet
        }
      }
    }
    return {
      result: needSynthesis,
      newQuantities: newQuantities,
      costStatus,
      quantityCanConsume,
      costSynthesised,
      valueFulfilled,
      valueTotal,
    }
  }

  const map = new Map<Task<G>, TaskExtra>()
  const result: [Task<G>, TaskExtra][] = []
  for (const task of tasks) {
    const taskExtra: TaskExtra = {
      status: TaskStatus.AllUnmet,
      costStatus: emptyTaskExtra.costStatus,
      quantityCanConsume: emptyTaskExtra.quantityCanConsume,
      costSynthesised: emptyTaskExtra.costSynthesised,
      valueFulfilled: emptyTaskExtra.valueFulfilled,
      valueTotal: emptyTaskExtra.valueTotal,
    }
    map.set(task, taskExtra)
    result.push([task, taskExtra])
    if (ga.getUserDataAdapter().isManuallyTask(task)) {
      taskExtra.status = TaskStatus.Manually
    } else {
      const { result, newQuantities, costStatus, quantityCanConsume, costSynthesised, valueFulfilled, valueTotal } =
        consumeItems(task.requires)
      taskExtra.costStatus = costStatus
      taskExtra.quantityCanConsume = quantityCanConsume
      taskExtra.costSynthesised = costSynthesised
      taskExtra.valueFulfilled = valueFulfilled
      taskExtra.valueTotal = valueTotal
      quantities = newQuantities!
      if (result == null) {
        taskExtra.status = TaskStatus.AllUnmet
      } else {
        if (result) {
          taskExtra.status = TaskStatus.Synthesizable
        } else {
          taskExtra.status = TaskStatus.Completable
        }

        const dependencyUnmet = !task.depends.every((x) => {
          const tx = map.get(x)
          if (!tx) return false
          switch (tx.status) {
            case TaskStatus.AllUnmet:
              return false
            case TaskStatus.Completable:
              return true
            case TaskStatus.DependencyUnmet:
              return false
            case TaskStatus.Synthesizable:
              return true
            case TaskStatus.Manually:
              return false
          }
        })

        if (dependencyUnmet) {
          taskExtra.status = TaskStatus.DependencyUnmet
        }
      }
    }
  }

  return tasks.map((x) => [x, map.get(x)!])
}
