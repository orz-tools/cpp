import pProps from 'p-props'
import { ExcelCharacterTable, ExcelPatchCharacterTable, ExcelSkillTable, ExcelUniEquipTable } from './excelTypes'
import localForage from 'localforage'

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
    }
  }
  public data!: Awaited<ReturnType<DataManager['transform']>>

  async loadRaw() {
    return (await pProps({
      exCharacters: DataManager.loadJson<ExcelCharacterTable>(
        'https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/zh_CN/gamedata/excel/character_table.json',
      ),
      exPatchCharacters: DataManager.loadJson<ExcelPatchCharacterTable>(
        'https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/zh_CN/gamedata/excel/char_patch_table.json',
      ),
      exSkills: DataManager.loadJson<ExcelSkillTable>(
        'https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/zh_CN/gamedata/excel/skill_table.json',
      ),
      exUniEquip: DataManager.loadJson<ExcelUniEquipTable>(
        'https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/zh_CN/gamedata/excel/uniequip_table.json',
      ),
    })) as {
      exCharacters: ExcelCharacterTable
      exPatchCharacters: ExcelPatchCharacterTable
      exSkills: ExcelSkillTable
      exUniEquip: ExcelUniEquipTable
    }
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
      Object.entries(this.raw.exUniEquip.equipDict).map(([key, raw]) => [key, new UniEquip(key, raw, this)]),
    )
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
    return this._skills || (this._skills = this.rawSkills.map((x) => [x, this.dm.data.skills[x.skillId]]))
  }

  get rawUniEquips() {
    return [
      ...(this.dm.raw.exUniEquip.charEquip[this.key] || []),
      ...this.patches.flatMap((x) => this.dm.raw.exUniEquip.charEquip[x[0]] || []),
    ]
  }

  private _uniEquips?: UniEquip[]
  get uniEquips() {
    return (this._uniEquips ||
      (this._uniEquips = (this.dm.raw.exUniEquip.charEquip[this.key] || [])
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
