import { describe, expect, it } from 'vitest'
import type { Task } from '../cpp-basic'
import '../testing/mockLocalforage'
import type { ArknightsDataManager, Character } from './DataManager'
import { ArknightsUserDataAdapter } from './UserDataAdapter'
import { Arknights, ArknightsCharacterStatus } from './types'

const cost = (id: string, count: number) => ({ id, count })

const constants = {
  characterExpMap: [1, 2, 3].map((x) => Array<number>(100).fill(x)),
  characterUpgradeCostMap: [10, 20, 30].map((x) => Array<number>(100).fill(x)),
  evolveGoldCost: [[], [100], [], [], [], [300, 600]],
}

function character(key: string, rarity: number, maxLevels: number[], skillCount: number) {
  return {
    key,
    rarity,
    maxLevels,
    maxElite: maxLevels.length - 1,
    modUnlockLevel: 60,
    raw: {
      phases: [{ evolveCost: null }, { evolveCost: [cost('m1', 2)] }, { evolveCost: [cost('m2', 3)] }],
    },
    // 没有技能的干员在游戏数据里就是空表
    allSkillLvlup: skillCount > 0 ? Array.from({ length: 6 }, () => ({ lvlUpCost: [cost('s', 1)] })) : [],
    skills: Array.from({ length: skillCount }, (_, i) => ({
      skillId: `${key}_s${i + 1}`,
      charSkillIndex: i,
      charSkill: { levelUpCostCond: [1, 2, 3].map((n) => ({ levelUpCost: [cost(`m${n}`, 1)] })) },
    })),
    uniEquips: [],
  } as unknown as Character
}

const characters: Record<string, Character> = {
  six: character('six', 5, [50, 80, 90], 3),
  // 像机械师：游戏数据照样列了材料
  special: Object.assign(character('special', 5, [50, 80, 90], 3), { isSpecialOperator: true }),
  // 带上特勤数据的特殊干员：技能等级只有 1、4、7
  nodes: Object.assign(character('nodes', 5, [50, 80, 90], 3), {
    isSpecialOperator: true,
    specialOperator: { skillLevels: [{ level: 4 }, { level: 7 }] },
  }),
  // 两星，像黑角：只到精零 30 级，没有技能
  two: character('two', 1, [30], 0),
  mods: Object.assign(character('mods', 5, [50, 80, 90], 2), {
    uniEquips: ['y', 'x'].map((m) => ({
      equipId: `mods_${m}`,
      equip: { raw: { itemCost: { 1: [cost(m, 1)], 2: [cost(m, 2)], 3: [cost(m, 3)] } } },
    })),
  }),
}

function setup() {
  const dm = { data: { characters, constants } } as unknown as ArknightsDataManager
  return new ArknightsUserDataAdapter(dm)
}

const status = (
  elite: number,
  level: number,
  rest: Partial<ArknightsCharacterStatus> = {},
): ArknightsCharacterStatus => ({
  elite,
  level,
  skillLevel: 1,
  skillMaster: {},
  modLevel: {},
  potentialRank: 0,
  ...rest,
})

const typesOf = (
  uda: ArknightsUserDataAdapter,
  charId: string,
  from: ArknightsCharacterStatus,
  to: ArknightsCharacterStatus,
  groupOrder?: readonly string[],
) => uda.generateTasksForCharacter(charId, from, to, groupOrder).map((x) => x.type)

describe('generateTasksForCharacter', () => {
  it('has no skill levels to pay for on an operator without skills, whatever the stored skill level', () => {
    const uda = setup()
    const levelled = [{ _: 'level', elite: 0, from: 1, to: 25 }]
    expect(typesOf(uda, 'two', status(0, 1), status(0, 25, { skillLevel: 4 }))).toEqual(levelled)
    expect(typesOf(uda, 'two', status(0, 1, { skillLevel: 2 }), status(0, 25, { skillLevel: 7 }))).toEqual(levelled)
  })

  it('stops at the end of the skill level, mastery and elite tables', () => {
    const uda = setup()
    const from = status(1, 80, { skillLevel: 7 })
    expect(typesOf(uda, 'six', from, status(1, 80, { skillLevel: 9 }))).toEqual([])
    expect(typesOf(uda, 'six', from, status(3, 1, { skillLevel: 7 }))).toEqual(
      typesOf(uda, 'six', from, status(2, 1, { skillLevel: 7 })),
    )
    const e2 = status(2, 1, { skillLevel: 7 })
    expect(typesOf(uda, 'six', e2, { ...e2, skillMaster: { six_s1: 5 } })).toEqual(
      typesOf(uda, 'six', e2, { ...e2, skillMaster: { six_s1: 3 } }),
    )
  })

  it("leaves a special operator's steps without materials, to be done by hand", () => {
    const uda = setup()
    const from = status(0, 1)
    const to = (key: string) => status(2, 90, { skillLevel: 7, skillMaster: { [`${key}_s1`]: 3 } })
    const special = uda.generateTasksForCharacter('special', from, to('special'))
    const six = uda.generateTasksForCharacter('six', from, to('six'))
    expect(special.map((x) => x.type._)).toEqual(six.map((x) => x.type._))
    expect(special.flatMap((x) => x.requires)).toEqual([])
    expect(special.every((x) => uda.isManuallyTask(x))).toBe(true)
    expect(six.some((x) => uda.isManuallyTask(x))).toBe(false)
  })

  describe("steps a special operator's skill level through its missions' levels", () => {
    const skillTasks = (charId: string, from: ArknightsCharacterStatus, to: ArknightsCharacterStatus) =>
      setup()
        .generateTasksForCharacter(charId, from, to)
        .filter((x) => x.type._ === 'skill')

    it('takes 1 to 7 in two steps, the second after E1', () => {
      const tasks = setup().generateTasksForCharacter('nodes', status(0, 1), status(1, 1, { skillLevel: 7 }))
      const skills = tasks.filter((x) => x.type._ === 'skill')
      expect(skills.map((x) => x.type)).toEqual([
        { _: 'skill', to: 4 },
        { _: 'skill', to: 7 },
      ])
      const elite = tasks.find((x) => x.type._ === 'elite')!
      expect(skills[1].depends).toContain(elite)
      expect(skills[0].depends).not.toContain(elite)
    })

    it('goes on from a stored level between the steps, and stops at a planned one', () => {
      const e1 = status(1, 1)
      expect(skillTasks('nodes', { ...e1, skillLevel: 5 }, { ...e1, skillLevel: 7 }).map((x) => x.type)).toEqual([
        { _: 'skill', to: 7 },
      ])
      expect(skillTasks('nodes', e1, { ...e1, skillLevel: 5 }).map((x) => x.type)).toEqual([
        { _: 'skill', to: 4 },
        { _: 'skill', to: 5 },
      ])
    })

    it('leaves the other operators level by level', () => {
      const from = status(0, 1)
      const to = status(1, 1, { skillLevel: 7 })
      const levels = [2, 3, 4, 5, 6, 7].map((l) => ({ _: 'skill', to: l }))
      expect(skillTasks('six', from, to).map((x) => x.type)).toEqual(levels)
      expect(skillTasks('six', from, to).map((x) => x.requires)).toEqual(
        levels.map(() => [{ itemId: 's', quantity: 1 }]),
      )
      expect(skillTasks('special', from, to).map((x) => x.type)).toEqual(levels)
    })
  })

  describe('groupOrder', () => {
    const e1 = status(1, 80, { skillLevel: 7 })
    const e2 = status(2, 60, { skillLevel: 7 })
    const mixed = status(2, 1, { skillLevel: 7, skillMaster: { mods_s1: 1 }, modLevel: { mods_y: 1 } })
    const four = { ...e2, skillMaster: { mods_s2: 1, mods_s1: 1 }, modLevel: { mods_y: 1, mods_x: 2 } }

    it('keeps the default order without one: masteries before modules', () => {
      const uda = setup()
      const tasks = uda.generateTasksForCharacter('mods', e2, four)
      expect(uda.generateTasksForCharacter('mods', e2, four, undefined)).toEqual(tasks)
      expect(uda.generateTasksForCharacter('mods', e2, four, [])).toEqual(tasks)
      expect(tasks.map((x) => x.type._)).toEqual(['skillMaster', 'skillMaster', 'mod', 'mod', 'mod'])
    })

    it('brings E2 and the level a module needs before the module, and the mastery after them', () => {
      const tasks = setup().generateTasksForCharacter('mods', e1, mixed, ['mod:mods_y', 'skillMaster:mods_s1'])
      expect(tasks.map((x) => x.type)).toEqual([
        { _: 'elite', elite: 2 },
        { _: 'level', elite: 2, from: 1, to: 60 },
        { _: 'mod', modId: 'mods_y', to: 1 },
        { _: 'skillMaster', skillId: 'mods_s1', to: 1 },
      ])
      expect(tasks[3].depends).toContain(tasks[1])
    })

    it('is the order today without one', () => {
      expect(typesOf(setup(), 'mods', e1, mixed)).toEqual([
        { _: 'elite', elite: 2 },
        { _: 'skillMaster', skillId: 'mods_s1', to: 1 },
        { _: 'level', elite: 2, from: 1, to: 60 },
        { _: 'mod', modId: 'mods_y', to: 1 },
      ])
    })

    it('puts the groups it leaves out after the listed one, in default order', () => {
      expect(typesOf(setup(), 'mods', e2, four, ['mod:mods_x'])).toEqual([
        { _: 'mod', modId: 'mods_x', to: 1 },
        { _: 'mod', modId: 'mods_x', to: 2 },
        { _: 'skillMaster', skillId: 'mods_s2', to: 1 },
        { _: 'skillMaster', skillId: 'mods_s1', to: 1 },
        { _: 'mod', modId: 'mods_y', to: 1 },
      ])
    })

    it('skips listed groups that are not in the plan', () => {
      expect(typesOf(setup(), 'mods', e2, four, ['mod:gone', 'skillMaster:mods_s1', 'skillMaster:gone'])).toEqual([
        { _: 'skillMaster', skillId: 'mods_s1', to: 1 },
        { _: 'skillMaster', skillId: 'mods_s2', to: 1 },
        { _: 'mod', modId: 'mods_y', to: 1 },
        { _: 'mod', modId: 'mods_x', to: 1 },
        { _: 'mod', modId: 'mods_x', to: 2 },
      ])
    })

    it('marks masteries and modules with their group, and nothing else', () => {
      const tasks = setup().generateTasksForCharacter('mods', status(0, 1), four)
      const groupOf = (x: (typeof tasks)[number]) =>
        x.type._ === 'skillMaster' ? `skillMaster:${x.type.skillId}` : x.type._ === 'mod' ? `mod:${x.type.modId}` : null
      expect(tasks.some((x) => groupOf(x) === null)).toBe(true)
      for (const task of tasks) {
        const group = groupOf(task)
        if (group) expect(task.group).toBe(group)
        else expect('group' in task).toBe(false)
      }
    })
  })

  // 任务列表里一名干员的行总是前置在前，「完成至此」才能从最上面一项项往下完成：每完成一项，剩下的正好是后面那些
  describe('completing a plan in list order', () => {
    // 和 allStarredTasksDetails 一样：星标的一项连同它一路的前置按生成顺序排在最前，其余的按生成顺序跟在后面
    const starredFirst = (tasks: readonly Task<Arknights>[], starred: Task<Arknights>) => {
      const chain = new Set<Task<Arknights>>()
      const visit = (t: Task<Arknights>) => {
        chain.add(t)
        t.depends.forEach(visit)
      }
      visit(starred)
      return [...tasks.filter((t) => chain.has(t)), ...tasks.filter((t) => !chain.has(t))]
    }

    const ids = (tasks: readonly Task<Arknights>[]) => tasks.map((t) => t.id).sort()

    const check = (
      charId: string,
      from: ArknightsCharacterStatus,
      to: ArknightsCharacterStatus,
      starred: Task<Arknights>,
      tasks: readonly Task<Arknights>[],
    ) => {
      const uda = setup()
      const orders = { generated: tasks, starredFirst: starredFirst(tasks, starred) }
      expect(orders.starredFirst.map((t) => t.id)).not.toEqual(tasks.map((t) => t.id))
      for (const [name, order] of Object.entries(orders)) {
        // completeTask 不看前置：模组 1 级先做了，精二照样留着，剩下的 id 也对得上，所以前置在前要另外查
        order.forEach((t, i) =>
          expect(order.slice(0, i), `${name}: ${t.id}`).toEqual(expect.arrayContaining(t.depends)),
        )
        for (let n = 1; n <= order.length; n++) {
          const s = structuredClone(from)
          for (const t of order.slice(0, n)) uda.completeTask(t.type, charId, s)
          expect(ids(uda.generateTasksForCharacter(charId, s, to)), `${name}, ${n} done`).toEqual(ids(order.slice(n)))
        }
      }
    }

    it('holds for skill levels, E2, a mastery, a module and the levels between them', () => {
      const from = status(1, 50, { skillLevel: 4 })
      const to = status(2, 90, { skillLevel: 7, skillMaster: { mods_s1: 3 }, modLevel: { mods_y: 2 } })
      const tasks = setup().generateTasksForCharacter('mods', from, to)
      expect(tasks).toHaveLength(12)
      const mod = tasks.find((t) => t.type._ === 'mod' && t.type.modId === 'mods_y' && t.type.to === 1)!
      check('mods', from, to, mod, tasks)
    })

    it('holds from recruiting on', () => {
      const from = status(0, 0)
      const to = status(1, 1, { skillLevel: 7 })
      const tasks = setup().generateTasksForCharacter('six', from, to)
      expect(tasks[0].type).toEqual({ _: 'join' })
      const elite = tasks.find((t) => t.type._ === 'elite' && t.type.elite === 1)!
      check('six', from, to, elite, tasks)
    })
  })
})

describe('rewriteCharacters', () => {
  it('corrects a character without a plan, as imports write them', () => {
    const uda = setup()
    expect(uda.rewriteCharacters('two', status(0, 25, { skillLevel: 4 }), undefined)).toEqual([
      status(0, 25),
      undefined,
    ])
    expect(uda.rewriteCharacters('six', status(0, 40, { skillLevel: 7 }), undefined)).toEqual([
      status(0, 40, { skillLevel: 4 }),
      undefined,
    ])
  })

  it('keeps a character without a plan that the game data does not know', () => {
    const current = status(0, 25, { skillLevel: 4 })
    const [c, g] = setup().rewriteCharacters('new', current, undefined)
    expect(c).toBe(current)
    expect(c).toEqual(status(0, 25, { skillLevel: 4 }))
    expect(g).toBeUndefined()
  })

  it('drops a character without a plan that is not held', () => {
    expect(setup().rewriteCharacters('two', status(0, 0, { skillLevel: 4 }), undefined)).toEqual([undefined, undefined])
  })
})

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

const EXP = [Array(50).fill(100), Array(80).fill(120), Array(90).fill(200)]
const GOLD = [Array(50).fill(30), Array(80).fill(48), Array(90).fill(80)]
const EVOLVE_GOLD = [
  [-1, -1],
  [-1, -1],
  [10000, -1],
  [15000, 60000],
  [20000, 120000],
  [30000, 180000],
]

function charStub(key = 'char_1') {
  return {
    key,
    raw: {
      displayNumber: '01',
      rarity: 'TIER_5',
      profession: 'CASTER',
      phases: [
        null,
        {
          evolveCost: [
            { id: 'chip1', count: 4 },
            { id: 'chip2', count: 2 },
          ],
        },
        { evolveCost: [{ id: 'chip3', count: 1 }] },
      ],
      allSkillLvlup: [1, 2, 3, 4, 5, 6, 7].map((n) => ({
        lvlUpCost: [{ id: 't' + n, count: n }],
        unlockCond: null,
      })),
      skills: [
        {
          skillId: 'sk1',
          charSkillIndex: 0,
          levelUpCostCond: [
            { levelUpCost: [{ id: 'm1', count: 1 }] },
            { levelUpCost: [{ id: 'm2', count: 2 }] },
            { levelUpCost: [{ id: 'm3', count: 4 }] },
          ],
        },
      ],
    },
    maxElite: 2,
    maxLevels: [50, 80, 90],
    rarity: 5,
    modUnlockLevel: 40,
    allSkillLvlup: [1, 2, 3, 4, 5, 6, 7].map((n) => ({
      lvlUpCost: [{ id: 't' + n, count: n }],
      unlockCond: null,
    })),
    skills: [
      {
        skillId: 'sk1',
        rawCharId: key,
        charSkillIndex: 0,
        charSkill: {
          skillId: 'sk1',
          charSkillIndex: 0,
          levelUpCostCond: [
            { levelUpCost: [{ id: 'm1', count: 1 }] },
            { levelUpCost: [{ id: 'm2', count: 2 }] },
            { levelUpCost: [{ id: 'm3', count: 4 }] },
          ],
        },
        skill: { name: 'Ignition' },
      },
    ],
    uniEquips: [
      {
        equipId: 'uniequip_1',
        rawCharId: key,
        equip: {
          raw: {
            unlockEvolvePhase: 'PHASE_2',
            typeName2: 'X',
            charEquipOrder: 1,
            itemCost: {
              1: [{ id: 'u1', count: 1 }],
              2: [{ id: 'u2', count: 2 }],
              3: [{ id: 'u3', count: 3 }],
            },
          },
          name: 'Module X',
        },
      },
    ],
  }
}

function makeDm() {
  const char2 = charStub('char_2')
  ;(char2.raw as any).displayNumber = undefined
  return {
    data: {
      characters: { char_1: charStub(), char_2: char2 },
      constants: {
        maxLevel: [[30], [30], [40, 55], [45, 60, 70], [50, 70, 80], [50, 80, 90]],
        characterExpMap: EXP,
        characterUpgradeCostMap: GOLD,
        evolveGoldCost: EVOLVE_GOLD,
      },
      items: {},
      skills: {},
      uniEquips: {},
    },
  }
}

function makeAdapter() {
  return new ArknightsUserDataAdapter(makeDm() as any)
}

const st = (
  elite = 0,
  level = 0,
  skillLevel = 1,
  skillMaster: Record<string, number> = {},
  modLevel: Record<string, number> = {},
): ArknightsCharacterStatus => ({ elite, level, skillLevel, skillMaster, modLevel })

describe('ArknightsUserDataAdapter', () => {
  it('returns frozen empty status', () => {
    const adapter = makeAdapter()
    expect(adapter.getFrozenEmptyCharacterStatus()).toEqual({
      elite: 0,
      level: 0,
      skillLevel: 1,
      skillMaster: {},
      modLevel: {},
      potentialRank: 0,
    })
  })

  it('lists only characters with a display number', () => {
    expect(makeAdapter().getAllCharacterIds()).toEqual(['char_1'])
  })

  describe('compareCharacter / isAbsentCharacter / isFavCharacter', () => {
    const a = { rarity: 5 } as any
    const b = { rarity: 4 } as any

    it('sorts by rarity, elite and level', () => {
      const adapter = makeAdapter()
      expect(adapter.compareCharacter(a, b, st(0, 1), st(0, 1))).toBe(-1)
      expect(adapter.compareCharacter(b, a, st(0, 1), st(0, 1))).toBe(1)
      expect(adapter.compareCharacter(a, a, st(2, 90), st(2, 80))).toBe(-1)
      expect(adapter.compareCharacter(a, a, st(1, 50), st(2, 90))).toBe(1)
      expect(adapter.compareCharacter(a, a, st(2, 90), st(2, 90))).toBe(0)
    })

    it('detects absent and favorite characters', () => {
      const adapter = makeAdapter()
      expect(adapter.isAbsentCharacter(a, st(0, 0))).toBe(true)
      expect(adapter.isAbsentCharacter(a, st(0, 1))).toBe(false)
      expect(adapter.isFavCharacter(a, st(1, 50))).toBe(true)
      expect(adapter.isFavCharacter(a, st(2, 1))).toBe(false)
    })
  })

  it('marks join tasks as manual', () => {
    const adapter = makeAdapter()
    expect(adapter.isManuallyTask({ id: 'x', charId: 'char_1', type: { _: 'join' }, requires: [], depends: [] })).toBe(
      true,
    )
    expect(
      adapter.isManuallyTask({
        id: 'x',
        charId: 'char_1',
        type: { _: 'level', elite: 0, from: 1, to: 2 },
        requires: [],
        depends: [],
      }),
    ).toBe(false)
  })

  describe('generateTasksForCharacter', () => {
    it('returns no tasks when current equals goal', () => {
      expect(makeAdapter().generateTasksForCharacter('char_1', st(2, 90, 7), st(2, 90, 7))).toEqual([])
    })

    it('creates a join task followed by a level task for new characters', () => {
      const tasks = makeAdapter().generateTasksForCharacter('char_1', st(), st(0, 30))
      expect(tasks.map((t) => t.type)).toEqual([{ _: 'join' }, { _: 'level', elite: 0, from: 1, to: 30 }])
      expect(tasks[1].requires).toEqual([
        { itemId: '##EXP', quantity: sum(EXP[0].slice(0, 29)) },
        { itemId: '4001', quantity: sum(GOLD[0].slice(0, 29)) },
      ])
      expect(tasks[1].depends).toEqual([tasks[0]])
    })

    it('chains elite and level tasks up to the goal', () => {
      const tasks = makeAdapter().generateTasksForCharacter('char_1', st(0, 1), st(2, 90))
      expect(tasks.map((t) => t.type)).toEqual([
        { _: 'level', elite: 0, from: 1, to: 50 },
        { _: 'elite', elite: 1 },
        { _: 'level', elite: 1, from: 1, to: 80 },
        { _: 'elite', elite: 2 },
        { _: 'level', elite: 2, from: 1, to: 90 },
      ])
      expect(tasks[1].requires).toEqual([
        { itemId: '4001', quantity: 30000 },
        { itemId: 'chip1', quantity: 4 },
        { itemId: 'chip2', quantity: 2 },
      ])
      expect(tasks[3].requires).toEqual([
        { itemId: '4001', quantity: 180000 },
        { itemId: 'chip3', quantity: 1 },
      ])
      expect(tasks[2].depends).toEqual([tasks[1]])
      expect(tasks[4].depends).toEqual([tasks[3]])
    })

    it('requires elite 1 before skill level 5', () => {
      const tasks = makeAdapter().generateTasksForCharacter('char_1', st(0, 50), st(0, 50, 7))
      const elite = tasks.find((t) => t.type._ === 'elite')!
      expect(elite.type).toEqual({ _: 'elite', elite: 1 })
      const skills = tasks.filter((t) => t.type._ === 'skill')
      expect(skills).toHaveLength(6)
      expect(skills[0].requires).toEqual([{ itemId: 't1', quantity: 1 }])
      expect(skills[5].requires).toEqual([{ itemId: 't6', quantity: 6 }])
      expect(skills[3].depends[0]).toBe(elite)
      expect(skills[3].depends[1]).toBe(skills[2])
    })

    it('requires elite 2 before skill mastery', () => {
      const tasks = makeAdapter().generateTasksForCharacter('char_1', st(0, 50, 7), st(0, 50, 7, { sk1: 2 }))
      expect(tasks.map((t) => t.type)).toEqual([
        { _: 'elite', elite: 1 },
        { _: 'level', elite: 1, from: 1, to: 80 },
        { _: 'elite', elite: 2 },
        { _: 'skillMaster', skillId: 'sk1', to: 1 },
        { _: 'skillMaster', skillId: 'sk1', to: 2 },
      ])
      expect(tasks[3].requires).toEqual([{ itemId: 'm1', quantity: 1 }])
      expect(tasks[4].requires).toEqual([{ itemId: 'm2', quantity: 2 }])
      expect(tasks[4].depends[0]).toBe(tasks[2])
      expect(tasks[4].depends[1]).toBe(tasks[3])
    })

    it('requires elite 2 and level 40 before modules', () => {
      const tasks = makeAdapter().generateTasksForCharacter('char_1', st(0, 50), st(0, 50, 1, {}, { uniequip_1: 2 }))
      expect(tasks.map((t) => t.type)).toEqual([
        { _: 'elite', elite: 1 },
        { _: 'level', elite: 1, from: 1, to: 80 },
        { _: 'elite', elite: 2 },
        { _: 'level', elite: 2, from: 1, to: 40 },
        { _: 'mod', modId: 'uniequip_1', to: 1 },
        { _: 'mod', modId: 'uniequip_1', to: 2 },
      ])
      expect(tasks[4].requires).toEqual([{ itemId: 'u1', quantity: 1 }])
      expect(tasks[5].requires).toEqual([{ itemId: 'u2', quantity: 2 }])
      expect(tasks[5].depends[0]).toBe(tasks[3])
      expect(tasks[5].depends[1]).toBe(tasks[4])
    })
  })

  describe('rewriteCharacter', () => {
    it('resets a status that is elite 0 level 0', () => {
      const adapter = makeAdapter()
      const s = st(-1, NaN, 0, { sk1: 1 }, { uniequip_1: 1 })
      adapter.rewriteCharacter('char_1', s)
      expect(s).toEqual({ elite: 0, level: 0, skillLevel: 1, skillMaster: {}, modLevel: {}, potentialRank: 0 })
    })

    it('clamps elite, level, skills and modules to valid ranges', () => {
      const adapter = makeAdapter()
      const s = { ...st(9, 999, 9, { sk1: 5 }, { uniequip_1: 4 }), potentialRank: 9 }
      adapter.rewriteCharacter('char_1', s)
      expect(s).toEqual({
        elite: 2,
        level: 90,
        skillLevel: 7,
        skillMaster: { sk1: 3 },
        modLevel: { uniequip_1: 3 },
        potentialRank: 5,
      })
    })

    it('caps skill level at 4 before elite 1', () => {
      const adapter = makeAdapter()
      const s = st(0, 30, 5)
      adapter.rewriteCharacter('char_1', s)
      expect(s.skillLevel).toBe(4)
    })

    it('clears modules before elite 2', () => {
      const adapter = makeAdapter()
      const s = st(1, 50, 7, {}, { uniequip_1: 2 })
      adapter.rewriteCharacter('char_1', s)
      expect(s.modLevel).toEqual({})
      expect(s.skillMaster).toEqual({})
    })

    it('clears skill mastery before skill level 7', () => {
      const adapter = makeAdapter()
      const s = st(2, 50, 6, { sk1: 2 })
      adapter.rewriteCharacter('char_1', s)
      expect(s.skillMaster).toEqual({})
    })

    it('normalizes NaN levels to 1', () => {
      const adapter = makeAdapter()
      const s = st(1, NaN)
      adapter.rewriteCharacter('char_1', s)
      expect(s).toMatchObject({ elite: 1, level: 1 })
    })
  })

  describe('rewriteGoal / rewriteCharacters', () => {
    it('raises a goal that is behind the current status', () => {
      const adapter = makeAdapter()
      const current = st(2, 90, 7, { sk1: 3 }, { uniequip_1: 2 })
      const goal = st(1, 1, 1)
      adapter.rewriteGoal('char_1', current, goal)
      expect(goal).toEqual(current)
    })

    it('raises individual skill mastery and module goals', () => {
      const adapter = makeAdapter()
      const current = st(2, 90, 7, { sk1: 3 }, { uniequip_1: 2 })
      const goal = st(2, 90, 7, { sk1: 1 }, { uniequip_1: 1 })
      adapter.rewriteGoal('char_1', current, goal)
      expect(goal.skillMaster.sk1).toBe(3)
      expect(goal.modLevel.uniequip_1).toBe(2)
    })

    it('drops unknown characters', () => {
      const adapter = makeAdapter()
      expect(adapter.rewriteCharacters('nope', st(0, 1), st(0, 1))).toEqual([undefined, undefined])
    })

    it('drops the goal when it equals the current status after rewriting', () => {
      const adapter = makeAdapter()
      const current = st(1, 50)
      const goal = st(1, 10)
      const [c, g] = adapter.rewriteCharacters('char_1', current, goal)
      expect(c).toBe(current)
      expect(g).toBeUndefined()
    })

    it('drops the current status of absent characters', () => {
      const adapter = makeAdapter()
      const current = st(0, 0)
      const goal = st(1, 1)
      const [c, g] = adapter.rewriteCharacters('char_1', current, goal)
      expect(c).toBeUndefined()
      expect(g).toBe(goal)
    })
  })

  it('computes the finished status of a character, keeping its potential', () => {
    const finished = { elite: 2, level: 90, skillLevel: 7, skillMaster: { sk1: 3 }, modLevel: { uniequip_1: 3 } }
    expect(makeAdapter().finishedCharacterStatus('char_1', st(1, 40))).toEqual(finished)
    expect(makeAdapter().finishedCharacterStatus('char_1', { ...st(1, 40), potentialRank: 2 })).toEqual({
      ...finished,
      potentialRank: 2,
    })
  })

  describe('completeTask', () => {
    it('applies every task type to the status draft', () => {
      const adapter = makeAdapter()
      let d = st()
      adapter.completeTask({ _: 'join' }, 'char_1', d)
      expect(d).toMatchObject({ elite: 0, level: 1 })

      d = st()
      adapter.completeTask({ _: 'elite', elite: 2 }, 'char_1', d)
      expect(d).toMatchObject({ elite: 2, level: 1 })

      d = st()
      adapter.completeTask({ _: 'level', elite: 1, from: 1, to: 80 }, 'char_1', d)
      expect(d).toMatchObject({ elite: 1, level: 80 })

      d = st(2, 80, 7)
      adapter.completeTask({ _: 'skill', to: 7 }, 'char_1', d)
      expect(d.skillLevel).toBe(7)

      d = st(2, 90, 7)
      adapter.completeTask({ _: 'skillMaster', skillId: 'sk1', to: 3 }, 'char_1', d)
      expect(d.skillMaster.sk1).toBe(3)

      d = st(2, 90, 7)
      adapter.completeTask({ _: 'mod', modId: 'uniequip_1', to: 3 }, 'char_1', d)
      expect(d.modLevel.uniequip_1).toBe(3)
    })
  })

  describe('formatTaskAsString', () => {
    it('formats every task type', () => {
      const adapter = makeAdapter()
      expect(adapter.formatTaskAsString({ _: 'join' }, 'char_1')).toBe('招募')
      expect(adapter.formatTaskAsString({ _: 'skill', to: 5 }, 'char_1')).toBe('技能 5 级')
      expect(adapter.formatTaskAsString({ _: 'elite', elite: 1 }, 'char_1')).toBe('精一')
      expect(adapter.formatTaskAsString({ _: 'level', elite: 1, from: 1, to: 50 }, 'char_1')).toBe('精一等级 1 -> 50')
      expect(adapter.formatTaskAsString({ _: 'skillMaster', skillId: 'sk1', to: 3 }, 'char_1')).toBe(
        '1 技能专三: Ignition',
      )
      expect(adapter.formatTaskAsString({ _: 'mod', modId: 'uniequip_1', to: 2 }, 'char_1')).toBe(
        'X 模组 2 级: Module X',
      )
    })
  })
})
