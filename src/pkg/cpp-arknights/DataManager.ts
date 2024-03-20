import { BlobImages, blobImage } from '../blobcache'
import { BasicDataManager, Formula, ICharacter, IItem } from '../cpp-basic'
import { DataContainerObject } from '../dccache'
import {
  ArknightsHeyboxOperatorSurveyObject,
  ArknightsKengxxiaoObject,
  ArknightsPenguinObject,
  ArknightsYituliuOperatorSurveyObject,
  ArknightsYituliuValuesObject,
} from './DataObjects'
import { Category, myCategories } from './GameAdapter'
import {
  AK_ITEM_GOLD,
  AK_ITEM_UNKNOWN_SHIT,
  AK_ITEM_VIRTUAL_EXP,
  Arknights,
  ArknightsFormulaTag,
  ArknightsKengxxiao,
  ArknightsRegion,
} from './types'

export class ArknightsDataManager extends BasicDataManager<Arknights> {
  public readonly region!: ArknightsRegion
  public setRegion(region: string) {
    const validRegions = {
      [ArknightsRegion.zh_CN]: () => {
        this.$kengxxiaoLocal = null
        this.$penguin = new ArknightsPenguinObject('CN')
      },
      [ArknightsRegion.en_US]: () => {
        this.$kengxxiaoLocal = new ArknightsKengxxiaoObject('en_US')
        this.$penguin = new ArknightsPenguinObject('US')
      },
      [ArknightsRegion.ja_JP]: () => {
        this.$kengxxiaoLocal = new ArknightsKengxxiaoObject('ja_JP')
        this.$penguin = new ArknightsPenguinObject('JP')
      },
      [ArknightsRegion.ko_KR]: () => {
        this.$kengxxiaoLocal = new ArknightsKengxxiaoObject('ko_KR')
        this.$penguin = new ArknightsPenguinObject('KR')
      },
    } satisfies Record<ArknightsRegion, () => void>

    if (!Object.prototype.hasOwnProperty.call(validRegions, region)) {
      throw new Error('Invalid game region: ' + region)
    }

    ;(this as any).region = region as ArknightsRegion
    validRegions[this.region]()
  }

  public $kengxxiao = new ArknightsKengxxiaoObject('zh_CN')
  public $kengxxiaoLocal!: ArknightsKengxxiaoObject | null
  public $yituliu = new ArknightsYituliuValuesObject()
  public $penguin!: ArknightsPenguinObject
  public $surveyYituliu = new ArknightsYituliuOperatorSurveyObject()
  public $surveyHeybox = new ArknightsHeyboxOperatorSurveyObject()

  public getRequiredDataObjects(): Promise<DataContainerObject<any>[]> {
    return Promise.resolve([
      this.$kengxxiao,
      this.$yituliu,
      this.$penguin,
      this.$surveyYituliu,
      this.$surveyHeybox,
      ...(this.$kengxxiaoLocal ? [this.$kengxxiaoLocal] : []),
    ])
  }

  public loadRaw() {
    const k = this.get(this.$kengxxiao)
    const yituliu = this.get(this.$yituliu)
    const penguin = this.get(this.$penguin)
    const yituliuSurvey = this.get(this.$surveyYituliu)
    const heyboxSurvey = this.get(this.$surveyHeybox)
    const kLocal = this.$kengxxiaoLocal ? this.get(this.$kengxxiaoLocal) : null

    return Promise.resolve({
      exCharacters: k.data.exCharacters,
      exPatchCharacters: k.data.exPatchCharacters,
      exSkills: k.data.exSkills,
      exUniEquips: k.data.exUniEquips,
      exItems: k.data.exItems,
      exBuilding: k.data.exBuilding,
      exStage: k.data.exStage,
      exRetro: k.data.exRetro,
      exZone: k.data.exZone,
      exSkin: k.data.exSkin || {
        buildinEvolveMap: {},
        buildinPatchMap: {},
      },
      yituliuValue: yituliu.data.values,
      penguinMatrix: penguin.data,
      yituliuSurvey: yituliuSurvey.data,
      heyboxSurvey: heyboxSurvey.data,
      local: kLocal ? kLocal.data : null,
    })
  }

  public async transform() {
    await Promise.resolve()
    return {
      characters: this.generateCharacters(),
      skills: this.generateSkills(),
      uniEquips: this.generateUniEquips(),
      constants: this.generateConstants(),
      items: this.generateItems(),
      formulas: this.generateFormulas(),
      yituliuSurvey: this.generateYituliuSurvey(),
      heyboxSurvey: this.generateHeyboxSurvey(),
    }
  }

  private generateYituliuSurvey() {
    return Object.fromEntries(this.raw.yituliuSurvey.result.map((x) => [x.charId, x]))
  }

  private generateHeyboxSurvey() {
    return Object.fromEntries(this.raw.heyboxSurvey.rows.map((x) => [x.i, x]))
  }

  private generateCharacters() {
    return Object.fromEntries(
      Object.entries(this.raw.exCharacters).map(([key, raw]) => [
        key,
        new Character(
          key,
          raw,
          this.raw.local && Object.prototype.hasOwnProperty.call(this.raw.local.exCharacters, key)
            ? this.raw.local.exCharacters[key]
            : null,
          this,
        ),
      ]),
    )
  }

  private generateSkills() {
    return Object.fromEntries(
      Object.entries(this.raw.exSkills).map(([key, raw]) => [
        key,
        new Skill(
          key,
          raw,
          this.raw.local && Object.prototype.hasOwnProperty.call(this.raw.local.exSkills, key)
            ? this.raw.local.exSkills[key]
            : null,
          this,
        ),
      ]),
    )
  }

  private generateUniEquips() {
    return Object.fromEntries(
      Object.entries(this.raw.exUniEquips.equipDict).map(([key, raw]) => [
        key,
        new UniEquip(
          key,
          raw,
          this.raw.local && Object.prototype.hasOwnProperty.call(this.raw.local.exUniEquips.equipDict, key)
            ? this.raw.local.exUniEquips.equipDict[key]
            : null,
          this,
        ),
      ]),
    )
  }

  private generateItems() {
    const items = Object.fromEntries(
      Object.entries(this.raw.exItems.items).map(([key, raw]) => [
        key,
        new Item(
          key,
          raw,
          this.raw.local && Object.prototype.hasOwnProperty.call(this.raw.local.exItems.items, key)
            ? this.raw.local.exItems.items[key]
            : null,
          this,
        ),
      ]),
    )
    items[AK_ITEM_VIRTUAL_EXP] = new ExpItem(AK_ITEM_VIRTUAL_EXP, this)
    items[AK_ITEM_UNKNOWN_SHIT] = new UnknownShitItem(AK_ITEM_UNKNOWN_SHIT, this)

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
          ...(i.goldCost > 0 ? [{ itemId: AK_ITEM_GOLD, quantity: i.goldCost }] : []),
        ],
        tags: [],
        apCost: i.apCost / 360000,
      }
      if (this.raw.exItems.items[i.itemId].rarity === 'TIER_3' && i.formulaType === 'F_EVOLVE') {
        formula.tags.push(ArknightsFormulaTag.WorkshopRarity2)
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

export interface CharacterLevel {
  elite: number
  level: number
}

export class Character implements ICharacter {
  public constructor(
    public readonly key: string,
    public readonly raw: ArknightsKengxxiao['exCharacters'][''],
    public readonly rawLocal: ArknightsKengxxiao['exCharacters'][''] | null,
    private readonly dm: ArknightsDataManager,
  ) {
    if (dm.raw.exPatchCharacters.infos[key]) {
      this.patches = dm.raw.exPatchCharacters.infos[key].tmplIds
        .map((x) => [x, dm.raw.exPatchCharacters.patchChars[x]] as const)
        .filter((x) => !!x[1])
    }
  }

  public get charIds(): string[] {
    return [this.key, ...this.patches.map((x) => x[0])]
  }

  public get name(): string {
    return this.rawLocal?.name || this.raw.name
  }

  public get appellation(): string {
    const value = this.rawLocal?.appellation.trim() || this.raw.appellation
    const name = this.name
    if (value === name) return this.raw.name
    return value
  }

  private readonly patches: (readonly [string, ArknightsKengxxiao['exCharacters']['']])[] = []

  public get defaultSkinId(): string {
    return this.dm.raw.exSkin.buildinEvolveMap[this.key]?.['0'] || ''
  }

  private _avatar?: [BlobImages]
  public get avatar() {
    return (this._avatar || (this._avatar = [this.avatarGenerator]))[0]
  }
  private get avatarGenerator() {
    const yysrc = `https://raw.githubusercontent.com/yuanyan3060/Arknights-Bot-Resource/main/avatar/${encodeURIComponent(
      this.key,
    )}.png`

    const defaultSkinId = this.defaultSkinId
    return {
      normal: blobImage(
        [
          ...(defaultSkinId
            ? [
                `https://web.hycdn.cn/arknights/game/assets/char_skin/avatar/${encodeURIComponent(
                  this.defaultSkinId,
                )}.png`,
              ]
            : []),
          yysrc,
        ],
        yysrc,
      ),
    }
  }

  public get rawSkills() {
    const result: [string, ArknightsKengxxiao['exCharacters']['']['skills'][0], number][] = []
    let index = 0
    for (const i of this.raw.skills || []) {
      result.push([this.key, i, index++])
    }
    for (const [key, info] of this.patches) {
      index = 0
      for (const i of info.skills || []) {
        result.push([key, i, index++])
      }
    }
    return result
  }

  private _skills?: [ArknightsKengxxiao['exCharacters']['']['skills'][0], Skill, string, number][]
  public get skills() {
    return (
      this._skills ||
      (this._skills = this.rawSkills
        .filter(
          (x): x is [string, ArknightsKengxxiao['exCharacters']['']['skills'][0] & { skillId: string }, number] =>
            !!x[1].skillId,
        )
        .map((x) => [x[1], this.dm.data.skills[x[1].skillId], x[0], x[2]]))
    )
  }

  public get rawUniEquips() {
    return [
      ...(this.dm.raw.exUniEquips.charEquip[this.key] || []),
      ...this.patches.flatMap((x) => this.dm.raw.exUniEquips.charEquip[x[0]] || []),
    ]
  }

  private _uniEquips?: UniEquip[]
  public get uniEquips() {
    return (this._uniEquips ||
      (this._uniEquips = (this.dm.raw.exUniEquips.charEquip[this.key] || [])
        .map((x) => this.dm.data.uniEquips[x])
        .sort((a, b) =>
          a.raw.charEquipOrder > b.raw.charEquipOrder ? 1 : a.raw.charEquipOrder < b.raw.charEquipOrder ? -1 : 0,
        )))!
  }

  public get rarity() {
    return {
      TIER_1: 0,
      TIER_2: 1,
      TIER_3: 2,
      TIER_4: 3,
      TIER_5: 4,
      TIER_6: 5,
      0: 0,
      1: 1,
      2: 2,
      3: 3,
      4: 4,
      5: 5,
    }[this.raw.rarity]!
  }

  public get maxElite() {
    return this.maxLevels.length - 1
  }

  public get maxLevels() {
    return this.dm.data.constants.maxLevel[this.rarity]
  }

  public get modUnlockLevel() {
    return this.dm.data.constants.modUnlockLevel[this.rarity]
  }

  public get allSkillLvlup() {
    if (this.raw?.allSkillLvlup) {
      return this.raw.allSkillLvlup
    }
    const cost: ArknightsKengxxiao['exCharacters']['']['allSkillLvlup'][0] = {
      lvlUpCost: [
        {
          count: 0,
          id: AK_ITEM_UNKNOWN_SHIT,
          type: UnknownShitItem.itemType,
        },
      ],
      unlockCond: null as any,
    }
    return [cost, cost, cost, cost, cost, cost, cost]
  }
}

export class Skill {
  public constructor(
    public readonly key: string,
    public readonly raw: ArknightsKengxxiao['exSkills'][''],
    public readonly rawLocal: ArknightsKengxxiao['exSkills'][''] | null,
    private readonly dm: ArknightsDataManager,
  ) {}

  public get name() {
    return this.rawLocal?.levels[0].name || this.raw.levels[0].name
  }

  private _icon?: [BlobImages]
  public get icon() {
    return (this._icon || (this._icon = [this.iconGenerator]))[0]
  }
  private get iconGenerator() {
    const yysrc = `https://raw.githubusercontent.com/yuanyan3060/Arknights-Bot-Resource/main/skill/skill_icon_${encodeURIComponent(
      this.raw.iconId || this.raw.skillId,
    )}.png`

    return {
      normal: blobImage(
        [`https://web.hycdn.cn/arknights/game/assets/char_skill/${encodeURIComponent(this.raw.skillId)}.png`, yysrc],
        yysrc,
      ),
    }
  }
}

export class UniEquip {
  public constructor(
    public readonly key: string,
    public readonly raw: ArknightsKengxxiao['exUniEquips']['equipDict'][''],
    public readonly rawLocal: ArknightsKengxxiao['exUniEquips']['equipDict'][''] | null,
    private readonly dm: ArknightsDataManager,
  ) {}

  public get name() {
    return this.rawLocal?.uniEquipName || this.raw.uniEquipName
  }

  private _icon?: [BlobImages]
  public get icon() {
    return (this._icon || (this._icon = [this.iconGenerator]))[0]
  }
  private get iconGenerator() {
    const yysrc = `https://raw.githubusercontent.com/Aceship/Arknight-Images/main/equip/type/${encodeURIComponent(
      this.raw.typeIcon.toLowerCase(),
    )}.png`

    return {
      normal: blobImage(
        [
          // TODO: hycdn's size is .... strange
          // `https://web.hycdn.cn/arknights/game/assets/uniequip/type/icon/${encodeURIComponent(
          //   this.raw.typeIcon.toLowerCase(),
          // )}.png`,
          yysrc,
        ],
        yysrc,
      ),
    }
  }
}

function makeNumericSortable(x: string) {
  return x.replace(/\d+/g, (y) => String(y).padStart(20, '0'))
}

export class Item implements IItem {
  public constructor(
    public readonly key: string,
    public readonly raw: ArknightsKengxxiao['exItems']['items'][''],
    public readonly rawLocal: ArknightsKengxxiao['exItems']['items'][''] | null,
    protected readonly dm: ArknightsDataManager,
  ) {}

  public get sortId(): string {
    return makeNumericSortable(this.raw.sortId.toFixed(0))
  }

  public get name(): string {
    return this.rawLocal?.name || this.raw.name
  }

  public get icon(): BlobImages {
    const yy = `https://raw.githubusercontent.com/yuanyan3060/Arknights-Bot-Resource/main/item/${encodeURIComponent(
      this.raw.iconId,
    )}.png`
    return { normal: yy }
  }

  private _valueAsAp?: [number | undefined]
  public get valueAsAp(): number | undefined {
    return (this._valueAsAp || (this._valueAsAp = [this._generateValueAsAp()]))[0]
  }

  public get valueAsApString(): string {
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
          const ap = this.dm.raw.yituliuValue.find((x) => x.itemId === this.key)?.itemValueAp
          if (ap == null) return NaN
          return ap / 0.625
        }
    }
    return this.dm.raw.yituliuValue.find((x) => x.itemId === this.key)?.itemValueAp
  }

  public get rarity() {
    return {
      TIER_1: 0,
      TIER_2: 1,
      TIER_3: 2,
      TIER_4: 3,
      TIER_5: 4,
      TIER_6: 5,
      0: 0,
      1: 1,
      2: 2,
      3: 3,
      4: 4,
      5: 5,
    }[this.raw.rarity]!
  }

  public get inventoryCategory(): string {
    if (Object.hasOwn(myCategories, this.key)) return (myCategories as any)[this.key]
    if (this.rarity === 4) return Category.Rarity4
    if (this.rarity === 3) return Category.Rarity3
    if (this.rarity === 2) return Category.Rarity2
    if (this.rarity === 1) return Category.Rarity1
    if (this.rarity === 0) return Category.Rarity0
    return Category.Unknown
  }
}

export class ExpItem extends Item {
  public constructor(key: string, dm: ArknightsDataManager) {
    super(
      key,
      {
        itemId: key,
        name: '经验',
        // description: '竟有一种办法可以聚合四种作战记录。这么虚拟的物品，真的可以收下吗？真的吗？！',
        rarity: 'TIER_5',
        iconId: 'EXP_PLAYER',
        sortId: 10005,
        // usage: '聚合了作战录像的存储装置的装置，可以增加干员的经验值',
        // obtainApproach: '战斗获取',
        classifyType: 'NONE',
        itemType: '##EXP_VIRTUAL',
        // stageDropList: [],
        // buildingProductList: [],
      },
      dm.raw.local
        ? {
            itemId: key,
            name: 'EXP',
            rarity: 'TIER_5',
            iconId: 'EXP_PLAYER',
            sortId: 10005,
            classifyType: 'NONE',
            itemType: '##EXP_VIRTUAL',
          }
        : null,
      dm,
    )
  }

  protected override _generateValueAsAp() {
    return this.dm.data.items['2004'].valueAsAp! / this.dm.raw.exItems.expItems['2004'].gainExp
  }
}

export class UnknownShitItem extends Item {
  public static itemType = 'MATERIAL' as const

  public constructor(key: string, dm: ArknightsDataManager) {
    super(
      key,
      {
        itemId: key,
        name: '未知材料~(￣▽￣)~*',
        // description: '暂时没有数据捏~(￣▽￣)~*',
        rarity: 'TIER_5',
        iconId: 'AP_GAMEPLAY',
        sortId: 10005,
        // usage: '不知道捏~(￣▽￣)~*',
        // obtainApproach: '~(￣▽￣)~*',
        classifyType: 'NONE',
        itemType: UnknownShitItem.itemType,
        // stageDropList: [],
        // buildingProductList: [],
      },
      dm.raw.local
        ? {
            itemId: key,
            name: 'Unknown Material~(￣▽￣)~*',
            rarity: 'TIER_5',
            iconId: 'AP_GAMEPLAY',
            sortId: 10005,
            classifyType: 'NONE',
            itemType: UnknownShitItem.itemType,
          }
        : null,
      dm,
    )
  }

  protected override _generateValueAsAp() {
    return undefined
  }
}
