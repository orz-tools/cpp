import { BlobImages, blobImage } from '../blobcache'
import {
  BasicDataManager,
  ContainerGetter,
  DataSources,
  Formula,
  ICharacter,
  IItem,
  OptionalContainerGetter,
  makeNumericSortable,
} from '../cpp-basic'
import { DataContainerObject } from '../dccache'
import {
  ArknightsHeyboxOperatorSurveyObject,
  ArknightsKengxxiaoDetailsObject,
  ArknightsKengxxiaoObject,
  ArknightsPenguinObject,
  ArknightsPrtsSkinsObject,
  ArknightsYituliuOperatorSurveyObject,
} from './DataObjects'
import { Category, myCategories } from './GameAdapter'
import { Details, DetailsLoader } from './details'
import type { ItemValueResult } from './itemValue'
import { PrtsSkinsData, PrtsSkinsLoader } from './prtsSkins'
import { SpecialOperator, buildSpecialOperator } from './specialOperators'
import {
  AK_ITEM_GOLD,
  AK_ITEM_UNKNOWN_SHIT,
  AK_ITEM_VIRTUAL_EXP,
  Arknights,
  ArknightsFormulaTag,
  ArknightsKengxxiao,
  ArknightsRegion,
  Position,
  Profession,
} from './types'

const regionSources = {
  [ArknightsRegion.zh_CN]: { local: null, penguin: 'CN' },
  [ArknightsRegion.en_US]: { local: 'en_US', penguin: 'US' },
  [ArknightsRegion.ja_JP]: { local: 'ja_JP', penguin: 'JP' },
  [ArknightsRegion.ko_KR]: { local: 'ko_KR', penguin: 'KR' },
} satisfies Record<
  ArknightsRegion,
  { local: ArknightsKengxxiaoObject['lang'] | null; penguin: ArknightsPenguinObject['server'] }
>

export class ArknightsSources implements DataSources {
  public readonly kengxxiao = new ArknightsKengxxiaoObject('zh_CN')
  public readonly kengxxiaoLocal: ArknightsKengxxiaoObject | null
  public readonly penguin: ArknightsPenguinObject
  public readonly surveyYituliu = new ArknightsYituliuOperatorSurveyObject()
  public readonly surveyHeybox = new ArknightsHeyboxOperatorSurveyObject()
  public readonly kengxxiaoDetails = new ArknightsKengxxiaoDetailsObject('zh_CN')
  public readonly kengxxiaoDetailsLocal: ArknightsKengxxiaoDetailsObject | null
  /** PRTS only covers zh_CN */
  public readonly prtsSkins: ArknightsPrtsSkinsObject | null

  public constructor(public readonly region: ArknightsRegion) {
    const { local, penguin } = regionSources[region]
    this.kengxxiaoLocal = local ? new ArknightsKengxxiaoObject(local) : null
    this.kengxxiaoDetailsLocal = local ? new ArknightsKengxxiaoDetailsObject(local) : null
    this.penguin = new ArknightsPenguinObject(penguin)
    this.prtsSkins = local ? null : new ArknightsPrtsSkinsObject()
  }

  public get required(): DataContainerObject<any>[] {
    return [
      this.kengxxiao,
      this.penguin,
      this.surveyYituliu,
      this.surveyHeybox,
      ...(this.kengxxiaoLocal ? [this.kengxxiaoLocal] : []),
    ]
  }

  public get absolutelyRequired(): DataContainerObject<any>[] {
    return [this.kengxxiao, ...(this.kengxxiaoLocal ? [this.kengxxiaoLocal] : [])]
  }

  public get optional(): DataContainerObject<any>[] {
    return [this.penguin, this.surveyYituliu, this.surveyHeybox]
  }
}

function extractRaw(sources: ArknightsSources, getContainer: ContainerGetter, getOptional: OptionalContainerGetter) {
  const k = getContainer(sources.kengxxiao)
  // Penguin Statistics has no second host and the surveys come from other sites. Without the matrix there are no stages,
  // so no plan and no item values; without a survey its fields are empty. What reads them says so and offers 重试.
  const penguin = getOptional(sources.penguin)?.data ?? { matrix: [] }
  const yituliuSurvey = getOptional(sources.surveyYituliu)?.data ?? { result: [], userCount: 0, updateTime: '' }
  const heyboxSurvey = getOptional(sources.surveyHeybox)?.data ?? { rows: [] }
  const kLocal = sources.kengxxiaoLocal ? getContainer(sources.kengxxiaoLocal) : null
  // Containers stored before the worker published skins lack charSkins, brandList and exShop
  const exSkin: ArknightsKengxxiao['exSkin'] = {
    charSkins: {},
    brandList: {},
    buildinEvolveMap: {},
    buildinPatchMap: {},
    ...(k.data.exSkin as Partial<ArknightsKengxxiao['exSkin']> | undefined),
  }
  // Nor rooms, buffs and chars, before it published base skills
  const exBuilding: ArknightsKengxxiao['exBuilding'] = {
    ...k.data.exBuilding,
    rooms: k.data.exBuilding.rooms ?? {},
    buffs: k.data.exBuilding.buffs ?? {},
    chars: k.data.exBuilding.chars ?? {},
  }

  return {
    exCharacters: k.data.exCharacters,
    exPatchCharacters: k.data.exPatchCharacters,
    exSkills: k.data.exSkills,
    exUniEquips: k.data.exUniEquips,
    exItems: k.data.exItems,
    exBuilding,
    exStage: k.data.exStage,
    exRetro: k.data.exRetro,
    exZone: k.data.exZone,
    exSkin,
    exEnemies: k.data.exEnemies || { enemyData: {} },
    exShop: k.data.exShop || { recommendList: [], carousels: [] },
    // Nor exSpecialOperators, before it published special operators' unlock missions
    exSpecialOperators: k.data.exSpecialOperators || {
      modeData: [],
      operatorBasicData: {},
      operatorDetailData: {},
      nodeUnlockMissionData: {},
      masterNames: {},
    },
    penguinMatrix: penguin,
    yituliuSurvey,
    heyboxSurvey,
    local: kLocal ? kLocal.data : null,
  }
}

/** The data built from one set of containers. Objects built from it keep reading it after a newer one is committed. */
export interface ArknightsSnapshot {
  raw: ReturnType<typeof extractRaw>
  data: ReturnType<typeof transform>
  getItemValue(key: string): number | undefined
}

export class ArknightsDataManager extends BasicDataManager<Arknights, ArknightsSources, ArknightsSnapshot> {
  protected createSources(region: string) {
    if (!Object.prototype.hasOwnProperty.call(regionSources, region)) {
      throw new Error('Invalid game region: ' + region)
    }
    return new ArknightsSources(region as ArknightsRegion)
  }

  public get $kengxxiao() {
    return this.sources.kengxxiao
  }
  public get $kengxxiaoLocal() {
    return this.sources.kengxxiaoLocal
  }
  public get $penguin() {
    return this.sources.penguin
  }
  public get $surveyYituliu() {
    return this.sources.surveyYituliu
  }
  public get $surveyHeybox() {
    return this.sources.surveyHeybox
  }

  protected buildSnapshot(
    sources: ArknightsSources,
    getContainer: ContainerGetter,
    getOptional: OptionalContainerGetter,
  ): ArknightsSnapshot {
    const s = {
      raw: extractRaw(sources, getContainer, getOptional),
      getItemValue: (key: string) => this.getItemValue(key),
    } as ArknightsSnapshot
    s.data = transform(s)
    return s
  }

  private readonly detailsLoader = new DetailsLoader()

  /** The texts behind the status editor's (i) panels, downloaded the first time one opens. */
  public loadDetails(): Promise<Details> {
    const sources = this.sources
    return this.detailsLoader.get(
      { obj: sources.kengxxiaoDetails, versionId: this.get(sources.kengxxiao).version.id },
      sources.kengxxiaoLocal && sources.kengxxiaoDetailsLocal
        ? { obj: sources.kengxxiaoDetailsLocal, versionId: this.get(sources.kengxxiaoLocal).version.id }
        : null,
    )
  }

  private readonly prtsSkinsLoader = new PrtsSkinsLoader()

  /** Skin sale windows from PRTS, downloaded the first time the skins panel or a 时装 section shows; null outside zh_CN */
  public loadPrtsSkins(): Promise<PrtsSkinsData> | null {
    const obj = this.sources.prtsSkins
    return obj ? this.prtsSkinsLoader.get(obj) : null
  }

  public itemValueProvider?: () => ItemValueResult

  public getItemValue(key: string): number | undefined {
    const result = this.itemValueProvider?.()
    return result?.status === 'ok' ? result.values.get(key) : undefined
  }
}

function transform(s: ArknightsSnapshot) {
  return {
    characters: generateCharacters(s),
    skills: generateSkills(s),
    uniEquips: generateUniEquips(s),
    constants: generateConstants(),
    items: generateItems(s),
    baseBuffs: generateBaseBuffs(s),
    formulas: generateFormulas(s),
    yituliuSurvey: generateYituliuSurvey(s),
    heyboxSurvey: generateHeyboxSurvey(s),
  }
}

function generateYituliuSurvey(s: ArknightsSnapshot) {
  return Object.fromEntries(s.raw.yituliuSurvey.result.map((x) => [x.charId, x]))
}

function generateHeyboxSurvey(s: ArknightsSnapshot) {
  return Object.fromEntries(s.raw.heyboxSurvey.rows.map((x) => [x.i, x]))
}

function generateCharacters(s: ArknightsSnapshot) {
  return Object.fromEntries(
    Object.entries(s.raw.exCharacters).map(([key, raw]) => [
      key,
      new Character(
        key,
        raw,
        s.raw.local && Object.prototype.hasOwnProperty.call(s.raw.local.exCharacters, key)
          ? s.raw.local.exCharacters[key]
          : null,
        s,
      ),
    ]),
  )
}

function generateSkills(s: ArknightsSnapshot) {
  return Object.fromEntries(
    Object.entries(s.raw.exSkills).map(([key, raw]) => [
      key,
      new Skill(
        key,
        raw,
        s.raw.local && Object.prototype.hasOwnProperty.call(s.raw.local.exSkills, key)
          ? s.raw.local.exSkills[key]
          : null,
        s,
      ),
    ]),
  )
}

function generateUniEquips(s: ArknightsSnapshot) {
  return Object.fromEntries(
    Object.entries(s.raw.exUniEquips.equipDict).map(([key, raw]) => [
      key,
      new UniEquip(
        key,
        raw,
        s.raw.local && Object.prototype.hasOwnProperty.call(s.raw.local.exUniEquips.equipDict, key)
          ? s.raw.local.exUniEquips.equipDict[key]
          : null,
        s,
      ),
    ]),
  )
}

function generateItems(s: ArknightsSnapshot) {
  const items: Record<string, Item> = Object.fromEntries(
    Object.entries(s.raw.exItems.items).map(([key, raw]) => [
      key,
      new Item(
        key,
        raw,
        s.raw.local && Object.prototype.hasOwnProperty.call(s.raw.local.exItems.items, key)
          ? s.raw.local.exItems.items[key]
          : null,
        s,
      ),
    ]),
  )
  items[AK_ITEM_VIRTUAL_EXP] = new ExpItem(AK_ITEM_VIRTUAL_EXP, s)
  items[AK_ITEM_UNKNOWN_SHIT] = new UnknownShitItem(AK_ITEM_UNKNOWN_SHIT, s)

  return items
}

/** A base skill, in the region's language where it has one */
export interface BaseBuff {
  id: string
  name: string
  roomType: string
  skillIcon: string
  /** The game's own number for the skill alone, which the station screen sorts by; 0 for one that depends on others */
  efficiency: number
  sortId: number
  icon: BlobImages
}

/** One unlock in a character's base skill slot */
export interface BaseSkill {
  buff: BaseBuff
  /** Among the slots that have a skill: 0 or 1 */
  slot: number
  /** Within the slot, from the first skill to unlock */
  index: number
  elite: number
  level: number
}

export function generateBaseBuffs(s: ArknightsSnapshot) {
  const local = s.raw.local?.exBuilding.buffs ?? {}
  const buffs: Record<string, BaseBuff> = {}
  for (const [id, raw] of Object.entries({ ...s.raw.exBuilding.buffs, ...local })) {
    const src = `https://raw.githubusercontent.com/yuanyan3060/Arknights-Bot-Resource/main/building_skill/${encodeURIComponent(
      raw.skillIcon,
    )}.png`
    buffs[id] = {
      id,
      name: raw.buffName || s.raw.exBuilding.buffs[id]?.buffName || id,
      roomType: raw.roomType,
      skillIcon: raw.skillIcon,
      efficiency: raw.efficiency,
      sortId: raw.sortId,
      // The game's CDN does not serve these; the bot resources mirror them, as they do the avatars
      icon: { normal: blobImage([src], src) },
    }
  }
  return buffs
}

function generateConstants() {
  return {
    modUnlockLevel: [-1, -1, -1, 40, 50, 60],
    maxLevel: [[30], [30], [40, 55], [45, 60, 70], [50, 70, 80], [50, 80, 90]],
    characterExpMap: [
      [
        100, 117, 134, 151, 168, 185, 202, 219, 236, 253, 270, 287, 304, 321, 338, 355, 372, 389, 406, 423, 440, 457,
        474, 491, 508, 525, 542, 559, 574, 589, 605, 621, 637, 653, 669, 685, 701, 716, 724, 739, 749, 759, 770, 783,
        804, 820, 836, 852, 888, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
        -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
      ],
      [
        120, 172, 224, 276, 328, 380, 432, 484, 536, 588, 640, 692, 744, 796, 848, 900, 952, 1004, 1056, 1108, 1160,
        1212, 1264, 1316, 1368, 1420, 1472, 1524, 1576, 1628, 1706, 1784, 1862, 1940, 2018, 2096, 2174, 2252, 2330,
        2408, 2584, 2760, 2936, 3112, 3288, 3464, 3640, 3816, 3992, 4168, 4344, 4520, 4696, 4890, 5326, 6019, 6312,
        6505, 6838, 7391, 7657, 7823, 8089, 8355, 8621, 8887, 9153, 9419, 9605, 9951, 10448, 10945, 11442, 11939, 12436,
        12933, 13430, 13927, 14549, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
      ],
      [
        191, 303, 415, 527, 639, 751, 863, 975, 1087, 1199, 1311, 1423, 1535, 1647, 1759, 1871, 1983, 2095, 2207, 2319,
        2431, 2543, 2655, 2767, 2879, 2991, 3103, 3215, 3327, 3439, 3602, 3765, 3928, 4091, 4254, 4417, 4580, 4743,
        4906, 5069, 5232, 5395, 5558, 5721, 5884, 6047, 6210, 6373, 6536, 6699, 6902, 7105, 7308, 7511, 7714, 7917,
        8120, 8323, 8526, 8729, 9163, 9597, 10031, 10465, 10899, 11333, 11767, 12201, 12729, 13069, 13747, 14425, 15103,
        15781, 16459, 17137, 17815, 18493, 19171, 19849, 21105, 22361, 23617, 24873, 26129, 27385, 28641, 29897, 31143,
        -1,
      ],
    ],
    characterUpgradeCostMap: [
      [
        30, 36, 43, 50, 57, 65, 73, 81, 90, 99, 108, 118, 128, 138, 149, 160, 182, 206, 231, 258, 286, 315, 346, 378,
        411, 446, 482, 520, 557, 595, 635, 677, 720, 764, 809, 856, 904, 952, 992, 1042, 1086, 1131, 1178, 1229, 1294,
        1353, 1413, 1474, 1572, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
        -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
      ],
      [
        48, 71, 95, 120, 146, 173, 201, 231, 262, 293, 326, 361, 396, 432, 470, 508, 548, 589, 631, 675, 719, 765, 811,
        859, 908, 958, 1010, 1062, 1116, 1171, 1245, 1322, 1400, 1480, 1562, 1645, 1731, 1817, 1906, 1996, 2171, 2349,
        2531, 2717, 2907, 3100, 3298, 3499, 3705, 3914, 4127, 4344, 4565, 4807, 5294, 6049, 6413, 6681, 7098, 7753,
        8116, 8378, 8752, 9132, 9518, 9909, 10306, 10709, 11027, 11533, 12224, 12926, 13639, 14363, 15097, 15843, 16599,
        17367, 18303, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
      ],
      [
        76, 124, 173, 225, 279, 334, 392, 451, 513, 577, 642, 710, 780, 851, 925, 1001, 1079, 1159, 1240, 1324, 1410,
        1498, 1588, 1680, 1773, 1869, 1967, 2067, 2169, 2273, 2413, 2556, 2702, 2851, 3003, 3158, 3316, 3477, 3640,
        3807, 3976, 4149, 4324, 4502, 4684, 4868, 5055, 5245, 5438, 5634, 5867, 6103, 6343, 6587, 6835, 7086, 7340,
        7599, 7861, 8127, 8613, 9108, 9610, 10120, 10637, 11163, 11696, 12238, 12882, 13343, 14159, 14988, 15828, 16681,
        17545, 18422, 19311, 20213, 21126, 22092, 23722, 25380, 27065, 28778, 30519, 32287, 34083, 35906, 37745,
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

function generateFormulas(s: ArknightsSnapshot) {
  const formulas: Formula[] = []
  for (const i of Object.values(s.raw.exBuilding.workshopFormulas)) {
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
    if (s.raw.exItems.items[i.itemId].rarity === 'TIER_3' && i.formulaType === 'F_EVOLVE') {
      formula.tags.push(ArknightsFormulaTag.WorkshopRarity2)
    }
    formulas.push(formula)
  }

  for (const i of Object.values(s.raw.exBuilding.manufactFormulas)) {
    if (i.formulaType !== 'F_ASC') continue
    const formula: Formula = {
      id: `manufact-${i.formulaId}`,
      itemId: i.itemId,
      quantity: i.count,
      costs: i.costs.map((x) => ({ itemId: x.id, quantity: x.count })),
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

export interface CharacterLevel {
  elite: number
  level: number
}

export class Character implements ICharacter {
  public constructor(
    public readonly key: string,
    public readonly raw: ArknightsKengxxiao['exCharacters'][''],
    public readonly rawLocal: ArknightsKengxxiao['exCharacters'][''] | null,
    private readonly snapshot: ArknightsSnapshot,
  ) {
    if (snapshot.raw.exPatchCharacters.infos[key]) {
      this.patches = snapshot.raw.exPatchCharacters.infos[key].tmplIds
        .map((x) => [x, snapshot.raw.exPatchCharacters.patchChars[x]] as const)
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

  public readonly patches: (readonly [string, ArknightsKengxxiao['exCharacters']['']])[] = []

  public get hasPatches() {
    return this.patches.length > 0
  }

  public getPatchProfession(charId: string): Profession {
    if (charId === this.key) return this.raw.profession as Profession
    const patch = this.patches.find((x) => x[0] === charId)
    if (!patch) return Profession.TOKEN
    return patch[1].profession as Profession
  }

  public get position(): Position {
    return this.raw.position ?? 'NONE'
  }

  public getPatchPosition(charId: string): Position {
    if (charId === this.key) return this.position
    const patch = this.patches.find((x) => x[0] === charId)
    if (!patch) return 'NONE'
    return patch[1].position ?? 'NONE'
  }

  /**
   * 特殊干员（电弧、机械师）的等级、精英化、技能、专精、模组都靠集成战略的任务解锁，不花材料；
   * 游戏数据给机械师列的材料并不消耗。数据 worker 发布 spTargetType 之前存下的数据里没有这一项
   */
  public get isSpecialOperator(): boolean {
    return (this.raw.spTargetType ?? 'NONE') !== 'NONE'
  }

  private _specialOperator?: [SpecialOperator | undefined]
  /** 特殊干员在模式里的解锁条件；没有特勤数据（不是特殊干员，或数据 worker 发布之前存下的数据）时 undefined */
  public get specialOperator(): SpecialOperator | undefined {
    return (this._specialOperator ||= [
      buildSpecialOperator(
        this.key,
        (this.raw.skills ?? []).flatMap((s) => (s.skillId ? [s.skillId] : [])),
        this.snapshot.raw.exSpecialOperators,
        this.snapshot.raw.local?.exSpecialOperators,
      ),
    ])[0]
  }

  public get defaultSkinId(): string {
    return this.snapshot.raw.exSkin.buildinEvolveMap[this.key]?.['0'] || ''
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

  public generateSkills() {
    const result: CharacterSkill[] = []
    let index = 0

    for (const i of this.raw.skills || []) {
      index++
      if (!i.skillId) continue

      result.push({
        skillId: i.skillId,
        rawCharId: this.key,
        charSkill: i,
        charSkillIndex: index - 1,
        skill: this.snapshot.data.skills[i.skillId],
      })
    }

    for (const [key, info] of this.patches) {
      index = 0
      for (const i of info.skills || []) {
        index++
        if (!i.skillId) continue

        result.push({
          skillId: i.skillId,
          rawCharId: key,
          charSkill: i,
          charSkillIndex: index - 1,
          skill: this.snapshot.data.skills[i.skillId],
        })
      }
    }

    return result
  }

  private _skills?: CharacterSkill[]
  public get skills() {
    return this._skills || (this._skills = this.generateSkills())
  }

  public generateUniEquips() {
    const result: CharacterUniEquip[] = []

    for (const e of this.snapshot.raw.exUniEquips.charEquip[this.key] || []) {
      result.push({
        equipId: e,
        rawCharId: this.key,
        equip: this.snapshot.data.uniEquips[e],
      })
    }

    for (const [key] of this.patches) {
      for (const e of this.snapshot.raw.exUniEquips.charEquip[key] || []) {
        result.push({
          equipId: e,
          rawCharId: key,
          equip: this.snapshot.data.uniEquips[e],
        })
      }
    }

    return result
  }

  private _uniEquips?: CharacterUniEquip[]
  public get uniEquips() {
    return (this._uniEquips ||
      (this._uniEquips = this.generateUniEquips().sort((a, b) =>
        a.equip.raw.charEquipOrder > b.equip.raw.charEquipOrder
          ? 1
          : a.equip.raw.charEquipOrder < b.equip.raw.charEquipOrder
            ? -1
            : 0,
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
    return this.snapshot.data.constants.maxLevel[this.rarity]
  }

  public get modUnlockLevel() {
    return this.snapshot.data.constants.modUnlockLevel[this.rarity]
  }

  private _baseSkills?: BaseSkill[][]
  /** Each base skill slot with its skills in unlock order. The region's own list when it has this character, as the
   * regions update apart; empty slots are left out. */
  public get baseSkills(): BaseSkill[][] {
    return (this._baseSkills ||= this.generateBaseSkills())
  }

  private generateBaseSkills() {
    const local = this.snapshot.raw.local?.exBuilding.chars ?? {}
    const chars = Object.hasOwn(local, this.key) ? local : this.snapshot.raw.exBuilding.chars
    const buffs = this.snapshot.data.baseBuffs
    const slots: BaseSkill[][] = []
    for (const { buffData } of chars[this.key]?.buffChar ?? []) {
      const skills: BaseSkill[] = []
      for (const { buffId, cond } of buffData) {
        const buff = buffs[buffId]
        if (!buff) continue
        skills.push({
          buff,
          slot: slots.length,
          index: skills.length,
          elite: phaseNumber(cond.phase),
          level: cond.level,
        })
      }
      if (skills.length > 0) slots.push(skills)
    }
    return slots
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

function phaseNumber(phase: string) {
  return Number(phase.replace('PHASE_', '')) || 0
}

export class Skill {
  public constructor(
    public readonly key: string,
    public readonly raw: ArknightsKengxxiao['exSkills'][''],
    public readonly rawLocal: ArknightsKengxxiao['exSkills'][''] | null,
    private readonly snapshot: ArknightsSnapshot,
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
    private readonly snapshot: ArknightsSnapshot,
  ) {}

  public get name() {
    return this.rawLocal?.uniEquipName || this.raw.uniEquipName
  }

  /** 多形态干员（阿米娅）的模组属于哪个形态；属于基础形态时是 null */
  public get tmplId(): string | null {
    return this.raw.tmplId ?? null
  }

  public get formId(): string {
    return this.tmplId ?? this.raw.charId
  }

  private _missions?: UniEquipMission[]
  public get missions(): UniEquipMission[] {
    return (this._missions ||= this.generateMissions())
  }

  private generateMissions() {
    const all = this.snapshot.raw.exUniEquips.missionList ?? {}
    const local = this.snapshot.raw.local?.exUniEquips.missionList ?? {}
    return (this.raw.missionList ?? [])
      .filter((id) => Object.hasOwn(all, id))
      .map((id) => new UniEquipMission(id, all[id], Object.hasOwn(local, id) ? local[id] : null, this))
      .sort((a, b) => a.raw.uniEquipMissionSort - b.raw.uniEquipMissionSort)
  }

  private _icon?: [BlobImages]
  public get icon() {
    return (this._icon || (this._icon = [this.iconGenerator]))[0]
  }
  private get iconGenerator() {
    const yysrc = `https://raw.githubusercontent.com/PuppiizSunniiz/Arknight-Images/main/equip/type/${encodeURIComponent(
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

export class UniEquipMission {
  public constructor(
    public readonly id: string,
    public readonly raw: ArknightsKengxxiao['exUniEquips']['missionList'][''],
    public readonly rawLocal: ArknightsKengxxiao['exUniEquips']['missionList'][''] | null,
    public readonly uniEquip: UniEquip,
  ) {}

  public get template() {
    return this.raw.template
  }

  public get paramList() {
    return this.raw.paramList
  }

  /** 绑定的关卡；不绑关卡的任务是 null */
  public get stageId() {
    return this.raw.jumpStageId
  }

  public get desc() {
    return this.rawLocal?.desc || this.raw.desc
  }
}

export class Item implements IItem {
  public constructor(
    public readonly key: string,
    public readonly raw: ArknightsKengxxiao['exItems']['items'][''],
    public readonly rawLocal: ArknightsKengxxiao['exItems']['items'][''] | null,
    protected readonly snapshot: ArknightsSnapshot,
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
    }
    return this.snapshot.getItemValue(this.key)
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
  public constructor(key: string, snapshot: ArknightsSnapshot) {
    super(
      key,
      {
        itemId: key,
        name: '经验',
        // description: '竟有一种办法可以聚合四种作战记录。这么虚拟的道具，真的可以收下吗？真的吗？！',
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
      snapshot.raw.local
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
      snapshot,
    )
  }

  protected override _generateValueAsAp() {
    return this.snapshot.getItemValue(AK_ITEM_VIRTUAL_EXP)
  }
}

export class UnknownShitItem extends Item {
  public static itemType = 'MATERIAL' as const

  public constructor(key: string, snapshot: ArknightsSnapshot) {
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
      snapshot.raw.local
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
      snapshot,
    )
  }

  protected override _generateValueAsAp() {
    return undefined
  }
}

type CharacterSkill = {
  rawCharId: string
  skillId: string
  charSkill: ArknightsKengxxiao['exCharacters']['']['skills'][0]
  charSkillIndex: number
  skill: Skill
}

type CharacterUniEquip = {
  rawCharId: string
  equipId: string
  equip: UniEquip
}
