import localForage from 'localforage'
import pProps from 'p-props'
import {
  ExcelBuildingData,
  ExcelCharacterTable,
  ExcelItemTable,
  ExcelPatchCharacterTable,
  ExcelSkillTable,
  ExcelStageTable,
  ExcelUniEquipTable,
} from './excelTypes'
import { PenguinMatrix } from './penguinTypes'
import { YituliuValue } from './yituliuTypes'

const STORAGE_PREFIX = 'cpp_dm_'

const store = localForage.createInstance({
  name: 'cpp_dm',
})

export class DataManager {
  async init() {
    this.initialized = false
    this.raw = await this.loadRaw()
    this.data = await this.transform()
    this.initialized = true
  }
  public initialized: boolean = false

  async transform() {
    return {
      characters: this.generateCharacters(),
      skills: this.generateSkills(),
      uniEquips: this.generateUniEquips(),
      constants: this.generateConstants(),
      items: this.generateItems(),
      formulas: this.generateFormulas(),
    }
  }
  public data!: Awaited<ReturnType<DataManager['transform']>>

  async loadRaw() {
    const task = {
      exCharacters: DataManager.loadJson<ExcelCharacterTable>(
        'https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/zh_CN/gamedata/excel/character_table.json',
      ),
      exPatchCharacters: DataManager.loadJson<ExcelPatchCharacterTable>(
        'https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/zh_CN/gamedata/excel/char_patch_table.json',
      ),
      exSkills: DataManager.loadJson<ExcelSkillTable>(
        'https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/zh_CN/gamedata/excel/skill_table.json',
      ),
      exUniEquips: DataManager.loadJson<ExcelUniEquipTable>(
        'https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/zh_CN/gamedata/excel/uniequip_table.json',
      ),
      exItems: DataManager.loadJson<ExcelItemTable>(
        'https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/zh_CN/gamedata/excel/item_table.json',
      ),
      exBuilding: DataManager.loadJson<ExcelBuildingData>(
        'https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/zh_CN/gamedata/excel/building_data.json',
      ),
      exStage: DataManager.loadJson<ExcelStageTable>(
        'https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/zh_CN/gamedata/excel/stage_table.json',
      ),
      yituliuValue: DataManager.loadJson<YituliuValue[]>('https://backend.yituliu.site/api/item/export/json'),
      penguinMatrix: DataManager.loadJson<PenguinMatrix>(
        'https://penguin-stats.io/PenguinStats/api/v2/result/matrix?server=CN',
      ),
    }
    return (await pProps(task)) as any as { [K in keyof typeof task]: Awaited<(typeof task)[K]> }
  }
  public raw!: Awaited<ReturnType<DataManager['loadRaw']>>

  private static async loadJson<T>(url: string, key = url): Promise<T> {
    const fullKey = `${STORAGE_PREFIX}${key}`
    const existing = (await store.getItem<string>(fullKey)) || ''
    if (existing) {
      try {
        return JSON.parse(existing)
      } catch {}
    }
    const result = await (await fetch(url)).json()
    await store.setItem(fullKey, JSON.stringify(result))
    return result
  }

  private generateCharacters() {
    return Object.fromEntries(
      Object.entries(this.raw.exCharacters).map(([key, raw]) => [key, new Character(key, raw, this)]),
    )
  }

  private generateSkills() {
    return Object.fromEntries(Object.entries(this.raw.exSkills).map(([key, raw]) => [key, new Skill(key, raw, this)]))
  }

  private generateUniEquips() {
    return Object.fromEntries(
      Object.entries(this.raw.exUniEquips.equipDict).map(([key, raw]) => [key, new UniEquip(key, raw, this)]),
    )
  }

  private generateItems() {
    const items = Object.fromEntries(
      Object.entries(this.raw.exItems.items).map(([key, raw]) => [key, new Item(key, raw, this)]),
    )
    items[ITEM_VIRTUAL_EXP] = new ExpItem(ITEM_VIRTUAL_EXP, this)

    return items
  }

  private generateConstants() {
    return {
      modUnlockLevel: [-1, -1, -1, 40, 50, 60],
      maxLevel: [[30], [30], [40, 55], [45, 60, 70], [50, 70, 80], [50, 80, 90]],
      characterExpMap: [
        [
          100, 117, 134, 151, 168, 185, 202, 219, 236, 253, 270, 287, 304, 321, 338, 355, 372, 389, 406, 423, 440, 457,
          474, 491, 508, 525, 542, 559, 574, 589, 605, 621, 637, 653, 669, 685, 701, 716, 724, 739, 749, 759, 770, 783,
          804, 820, 836, 852, 888, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
          -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
        ],
        [
          120, 172, 224, 276, 328, 380, 432, 484, 536, 588, 640, 692, 744, 796, 848, 900, 952, 1004, 1056, 1108, 1160,
          1212, 1264, 1316, 1368, 1420, 1472, 1524, 1576, 1628, 1706, 1784, 1862, 1940, 2018, 2096, 2174, 2252, 2330,
          2408, 2584, 2760, 2936, 3112, 3288, 3464, 3640, 3816, 3992, 4168, 4344, 4520, 4696, 4890, 5326, 6019, 6312,
          6505, 6838, 7391, 7657, 7823, 8089, 8355, 8621, 8887, 9153, 9419, 9605, 9951, 10448, 10945, 11442, 11939,
          12436, 12933, 13430, 13927, 14549, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
        ],
        [
          191, 303, 415, 527, 639, 751, 863, 975, 1087, 1199, 1311, 1423, 1535, 1647, 1759, 1871, 1983, 2095, 2207,
          2319, 2431, 2543, 2655, 2767, 2879, 2991, 3103, 3215, 3327, 3439, 3602, 3765, 3928, 4091, 4254, 4417, 4580,
          4743, 4906, 5069, 5232, 5395, 5558, 5721, 5884, 6047, 6210, 6373, 6536, 6699, 6902, 7105, 7308, 7511, 7714,
          7917, 8120, 8323, 8526, 8729, 9163, 9597, 10031, 10465, 10899, 11333, 11767, 12201, 12729, 13069, 13747,
          14425, 15103, 15781, 16459, 17137, 17815, 18493, 19171, 19849, 21105, 22361, 23617, 24873, 26129, 27385,
          28641, 29897, 31143, -1,
        ],
      ],
      characterUpgradeCostMap: [
        [
          30, 36, 43, 50, 57, 65, 73, 81, 90, 99, 108, 118, 128, 138, 149, 160, 182, 206, 231, 258, 286, 315, 346, 378,
          411, 446, 482, 520, 557, 595, 635, 677, 720, 764, 809, 856, 904, 952, 992, 1042, 1086, 1131, 1178, 1229, 1294,
          1353, 1413, 1474, 1572, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
          -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
        ],
        [
          48, 71, 95, 120, 146, 173, 201, 231, 262, 293, 326, 361, 396, 432, 470, 508, 548, 589, 631, 675, 719, 765,
          811, 859, 908, 958, 1010, 1062, 1116, 1171, 1245, 1322, 1400, 1480, 1562, 1645, 1731, 1817, 1906, 1996, 2171,
          2349, 2531, 2717, 2907, 3100, 3298, 3499, 3705, 3914, 4127, 4344, 4565, 4807, 5294, 6049, 6413, 6681, 7098,
          7753, 8116, 8378, 8752, 9132, 9518, 9909, 10306, 10709, 11027, 11533, 12224, 12926, 13639, 14363, 15097,
          15843, 16599, 17367, 18303, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
        ],
        [
          76, 124, 173, 225, 279, 334, 392, 451, 513, 577, 642, 710, 780, 851, 925, 1001, 1079, 1159, 1240, 1324, 1410,
          1498, 1588, 1680, 1773, 1869, 1967, 2067, 2169, 2273, 2413, 2556, 2702, 2851, 3003, 3158, 3316, 3477, 3640,
          3807, 3976, 4149, 4324, 4502, 4684, 4868, 5055, 5245, 5438, 5634, 5867, 6103, 6343, 6587, 6835, 7086, 7340,
          7599, 7861, 8127, 8613, 9108, 9610, 10120, 10637, 11163, 11696, 12238, 12882, 13343, 14159, 14988, 15828,
          16681, 17545, 18422, 19311, 20213, 21126, 22092, 23722, 25380, 27065, 28778, 30519, 32287, 34083, 35906,
          37745,
        ],
      ],
      evolveGoldCost: [
        [-1, -1],
        [-1, -1],
        [10000, -1],
        [15000, 60000],
        [20000, 120000],
        [30000, 180000],
      ],
    }
  }

  private generateFormulas() {
    const formulas: Formula[] = []
    for (const i of Object.values(this.raw.exBuilding.workshopFormulas)) {
      if (i.formulaType === 'F_ASC') continue
      const formula: Formula = {
        id: `workshop-${i.formulaId}`,
        itemId: i.itemId,
        quantity: i.count,
        costs: [
          ...i.costs.map((x) => ({ itemId: x.id, quantity: x.count })),
          ...(i.goldCost > 0 ? [{ itemId: ITEM_GOLD, quantity: i.goldCost }] : []),
        ],
        tags: [],
        apCost: i.apCost / 360000,
      }
      if (this.raw.exItems.items[i.itemId].rarity === 2 && i.formulaType === 'F_EVOLVE') {
        formula.tags.push(FormulaTag.WorkshopRarity2)
      }
      formulas.push(formula)
    }

    for (const i of Object.values(this.raw.exBuilding.manufactFormulas)) {
      if (i.formulaType !== 'F_ASC') continue
      const formula: Formula = {
        id: `manufact-${i.formulaId}`,
        itemId: i.itemId,
        quantity: i.count,
        costs: [...i.costs.map((x) => ({ itemId: x.id, quantity: x.count }))],
        tags: [],
      }
      formulas.push(formula)
    }

    formulas.push({
      // 采购凭证 买 芯片助剂
      id: `shop-32001`,
      itemId: '32001',
      quantity: 1,
      costs: [{ itemId: '4006', quantity: 90 }],
      tags: [],
    })

    // for (const formula of formulas) {
    //   console.log(
    //     formula.id,
    //     formatItemStack(this, formula),
    //     '=',
    //     formula.costs.map((x) => formatItemStack(this, x)).join(' + '),
    //   )
    // }
    return formulas
  }
}

export function formatItemStack(dm: DataManager, { itemId, quantity }: { itemId: string; quantity: number }) {
  return `${dm.raw.exItems.items[itemId]?.name || itemId} x${quantity}`
}

interface Formula {
  id: string
  itemId: string
  quantity: number
  costs: {
    itemId: string
    quantity: number
  }[]
  tags: FormulaTag[]
  apCost?: number
}

export enum FormulaTag {
  WorkshopRarity2 = 'workshop_rarity_2',
}

export class Character {
  constructor(
    public readonly key: string,
    public readonly raw: ExcelCharacterTable.Character,
    private readonly dm: DataManager,
  ) {
    if (dm.raw.exPatchCharacters.infos[key]) {
      this.patches = dm.raw.exPatchCharacters.infos[key].tmplIds
        .map((x) => [x, dm.raw.exPatchCharacters.patchChars[x]] as const)
        .filter((x) => !!x[1])
    }
  }

  private readonly patches: (readonly [string, ExcelCharacterTable.Character])[] = []

  get avatar() {
    return `https://raw.githubusercontent.com/yuanyan3060/Arknights-Bot-Resource/main/avatar/${encodeURIComponent(
      this.key,
    )}.png`
  }

  get rawSkills() {
    return [...(this.raw.skills || []), ...this.patches.flatMap((x) => x[1].skills)]
  }

  private _skills?: [ExcelCharacterTable.Skill, Skill][]
  get skills() {
    return (
      this._skills ||
      (this._skills = this.rawSkills
        .filter((x): x is ExcelCharacterTable.Skill & { skillId: string } => !!x.skillId)
        .map((x) => [x, this.dm.data.skills[x.skillId]]))
    )
  }

  get rawUniEquips() {
    return [
      ...(this.dm.raw.exUniEquips.charEquip[this.key] || []),
      ...this.patches.flatMap((x) => this.dm.raw.exUniEquips.charEquip[x[0]] || []),
    ]
  }

  private _uniEquips?: UniEquip[]
  get uniEquips() {
    return (this._uniEquips ||
      (this._uniEquips = (this.dm.raw.exUniEquips.charEquip[this.key] || [])
        .map((x) => this.dm.data.uniEquips[x])
        .sort((a, b) =>
          a.raw.charEquipOrder > b.raw.charEquipOrder ? 1 : a.raw.charEquipOrder < b.raw.charEquipOrder ? -1 : 0,
        )))!
  }

  get rarity() {
    return this.raw.rarity
  }

  get maxElite() {
    return this.maxLevels.length - 1
  }

  get maxLevels() {
    return this.dm.data.constants.maxLevel[this.rarity]
  }

  get modUnlockLevel() {
    return this.dm.data.constants.modUnlockLevel[this.rarity]
  }
}

export class Skill {
  constructor(
    public readonly key: string,
    public readonly raw: ExcelSkillTable.Skill,
    private readonly dm: DataManager,
  ) {}

  get icon() {
    return `https://raw.githubusercontent.com/yuanyan3060/Arknights-Bot-Resource/main/skill/skill_icon_${encodeURIComponent(
      this.raw.iconId || this.raw.skillId,
    )}.png`
  }
}

export class UniEquip {
  constructor(
    public readonly key: string,
    public readonly raw: ExcelUniEquipTable.UniEquip,
    private readonly dm: DataManager,
  ) {}

  get icon() {
    return `https://raw.githubusercontent.com/Aceship/Arknight-Images/main/equip/type/${encodeURIComponent(
      this.raw.typeIcon.toLowerCase(),
    )}.png`
  }
}

export class Item {
  constructor(
    public readonly key: string,
    public readonly raw: ExcelItemTable.Item,
    protected readonly dm: DataManager,
  ) {}

  get icon() {
    return `https://raw.githubusercontent.com/yuanyan3060/Arknights-Bot-Resource/main/item/${encodeURIComponent(
      this.raw.iconId,
    )}.png`
  }

  private _valueAsAp?: [number | undefined]
  get valueAsAp(): number | undefined {
    return (this._valueAsAp || (this._valueAsAp = [this._generateValueAsAp()]))[0]
  }

  get valueAsApString(): string {
    if (this.valueAsAp == null) return ''
    return this.valueAsAp
      .toFixed(4)
      .replace(/(\.\d+?)0+$/, (_, orig) => orig)
      .replace(/\.$/, '')
  }

  protected _generateValueAsAp() {
    switch (this.key) {
      case 'mod_unlock_token': // 模组数据块
      case 'mod_update_token_2': // 数据增补仪
      case 'mod_update_token_1': // 数据增补条
        return undefined // 氪金也买不到，不应该有价值
      case '3213': // 先锋双芯片
        return this.dm.data.items['3212'].valueAsAp! * 2 + this.dm.data.items['32001'].valueAsAp!
      case '3223': // 近卫双芯片
        return this.dm.data.items['3222'].valueAsAp! * 2 + this.dm.data.items['32001'].valueAsAp!
      case '3233': // 重装双芯片
        return this.dm.data.items['3232'].valueAsAp! * 2 + this.dm.data.items['32001'].valueAsAp!
      case '3243': // 狙击双芯片
        return this.dm.data.items['3242'].valueAsAp! * 2 + this.dm.data.items['32001'].valueAsAp!
      case '3253': // 术师双芯片
        return this.dm.data.items['3252'].valueAsAp! * 2 + this.dm.data.items['32001'].valueAsAp!
      case '3263': // 医疗双芯片
        return this.dm.data.items['3262'].valueAsAp! * 2 + this.dm.data.items['32001'].valueAsAp!
      case '3273': // 辅助双芯片
        return this.dm.data.items['3272'].valueAsAp! * 2 + this.dm.data.items['32001'].valueAsAp!
      case '3283': // 特种双芯片
        return this.dm.data.items['3282'].valueAsAp! * 2 + this.dm.data.items['32001'].valueAsAp!
      default:
        if (this.dm.raw.exItems.expItems[this.key]) {
          return this.dm.raw.yituliuValue.find((x) => x.itemId == this.key)?.itemValueAp! / 0.625
        }
    }
    return this.dm.raw.yituliuValue.find((x) => x.itemId == this.key)?.itemValueAp
  }
}

export class ExpItem extends Item {
  constructor(key: string, dm: DataManager) {
    super(
      key,
      {
        itemId: key,
        name: '经验',
        description: '竟有一种办法可以聚合四种作战记录。这么虚拟的物品，真的可以收下吗？真的吗？！',
        rarity: 4,
        iconId: 'EXP_PLAYER',
        overrideBkg: null,
        stackIconId: null,
        sortId: 10005,
        usage: '聚合了作战录像的存储装置的装置，可以增加干员的经验值',
        obtainApproach: '战斗获取',
        classifyType: ExcelItemTable.ClassifyType.None,
        itemType: '##EXP_VIRTUAL',
        stageDropList: [],
        buildingProductList: [],
      },
      dm,
    )
  }

  protected override _generateValueAsAp() {
    return this.dm.data.items['2004'].valueAsAp! / this.dm.raw.exItems.expItems['2004'].gainExp
  }
}

export const ITEM_GOLD = '4001'
export const ITEM_VIRTUAL_EXP = '##EXP'
