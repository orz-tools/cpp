import { sortBy } from 'ramda'
import { GameName } from '../../games'
import {
  BasicStageInfo,
  ExpItem,
  IGameAdapter,
  PredefinedQuery,
  QNumber,
  QString,
  QueryParam,
  RootCharacterQuery,
} from '../cpp-basic'
import { ArknightsDataManager, Character } from './DataManager'
import { ArknightsUserDataAdapter } from './UserDataAdapter'
import { HeyboxSurveySource, YituliuSurveySource } from './survey'
import {
  AK_ITEM_GOLD,
  AK_ITEM_UNKNOWN_SHIT,
  AK_ITEM_VIRTUAL_EXP,
  Arknights,
  ArknightsKengxxiao,
  PreferenceKeys,
  SurveySourceKeys,
  formulaTagNames,
} from './types'

export class ArknightsAdapter implements IGameAdapter<Arknights> {
  public readPreference<K extends keyof Arknights['preferences']>(
    key: K,
    storage: Record<string, any>,
  ): Arknights['preferences'][K] {
    if (key === PreferenceKeys.SurveySource) {
      const value = storage[PreferenceKeys.SurveySource]
      return SurveySourceKeys.includes(value) ? value : SurveySourceKeys[0]
    }
    return undefined as never
  }

  public writePreference<K extends keyof Arknights['preferences']>(
    key: K,
    value: Arknights['preferences'][K],
    storage: Record<string, any>,
  ): Record<string, any> {
    if (key === PreferenceKeys.SurveySource) {
      return {
        ...storage,
        [key]: value,
      }
    }
    return storage
  }

  public getRealCharacterKey(charId: string) {
    if (this.getCharacter(charId)) return charId
    if (Object.hasOwn(this.dataManager.raw.exPatchCharacters.patchChars, charId)) {
      for (const v of Object.values(this.dataManager.raw.exPatchCharacters.infos)) {
        if (v.tmplIds.includes(charId)) return v.default
      }
    }
    return charId
  }

  private dataManager = new ArknightsDataManager()
  private userDataAdapter = new ArknightsUserDataAdapter(this.dataManager)

  public static codename: string = GameName.Arknights
  public getCodename(): string {
    return ArknightsAdapter.codename
  }

  public getDataManager() {
    return this.dataManager
  }

  public getUserDataAdapter() {
    return this.userDataAdapter
  }

  private rootCharacterQuery = new RootCharacterQuery<Arknights, Character>().tap((aa) => {
    aa.addField('name', '代号', QString, ({ character }) => character.name)
    aa.addField('code', '西文代号', QString, ({ character }) => character.appellation)
      .addAlias('appellation')
      .addAlias('en')
    aa.addField('rarity', '稀有度', QNumber, ({ character }) => character.rarity + 1).addAlias('star')

    aa.addStatusField('elite', '精英化', QNumber, ({ status }) => status.elite)
    aa.addStatusField('level', '等级', QNumber, ({ status }) => status.level)
    aa.addStatusField('elv', '精英化*100+等级', QNumber, ({ status }) => status.elite * 100 + status.level)
    aa.addStatusField('skillLevel', '技能等级', QNumber, ({ status }) => status.skillLevel)

    const hss = new HeyboxSurveySource(this.dataManager)
    const yss = new YituliuSurveySource(this.dataManager)

    aa.createSubQuery('skill', '技能', (character) => {
      return character.skills.map((_, index) => [index] as const)
    }).tap((sq) => {
      sq.addField(
        'name',
        '技能名',
        QString,
        ({ character, args: [index] }) => character.skills[index][1].raw.levels[0].name,
      )

      sq.addStatusField('mastery', '专精等级', QNumber, ({ character, status, args: [index] }) => {
        return status.skillMaster[character.skills[index][1].key] ?? 0
      })

      sq.addField('mastery3rate.yituliu', '一图流练度统计 技能专三率', QNumber, ({ character, args: [index] }) => {
        const s = yss.skill(
          character,
          character.skills[index][1],
          character.skills[index][2],
          character.skills[index][3],
        )
        if (s?.[0]?.percent == null || s?.[3]?.percent == null) return NaN
        return s?.[0]?.percent * s?.[3]?.percent
      })

      sq.addField('mastery3rate.heybox', '小黑盒干员统计 技能专三率', QNumber, ({ character, args: [index] }) => {
        const s = hss.skill(
          character,
          character.skills[index][1],
          character.skills[index][2],
          character.skills[index][3],
        )
        if (s?.[0]?.percent == null || s?.[3]?.percent == null) return NaN
        return s?.[0]?.percent * s?.[3]?.percent
      })
    })
  })

  public getRootCharacterQuery() {
    return this.rootCharacterQuery
  }

  public getDefaultCharacterQueryOrder(): QueryParam['order'] {
    return [
      ['rarity', 'DESC'],
      ['elite', 'DESC'],
      ['level', 'DESC'],
    ]
  }

  public getFavCharacterQueryWhere(): QueryParam['where'] {
    return {
      _: 'field',
      op: '<',
      field: 'elite',
      operand: 2,
    }
  }

  public getPredefinedQueries(): Record<string, PredefinedQuery> {
    return {
      'skill.mastery3rate.yituliu': {
        name: '一图流练度统计 技能专三率',
        query: {
          select: ['skill.mastery3rate.yituliu'],
          join: 'skill',
          where: {
            _: '&&',
            operand: [
              {
                _: '||',
                operand: [
                  { _: 'field', field: 'own', op: '==', operand: true },
                  { _: 'field', field: 'goal', op: '==', operand: true },
                ],
              },
              { _: 'field', field: 'skill.mastery', op: '<', operand: 3 },
              { _: 'field', field: 'rarity', op: '==', operand: 6 },
            ],
          },
          order: [['skill.mastery3rate.yituliu', 'DESC']],
        },
      },
      'skill.mastery3rate.heybox': {
        name: '小黑盒干员统计 技能专三率',
        query: {
          select: ['skill.mastery3rate.heybox'],
          join: 'skill',
          where: {
            _: '&&',
            operand: [
              {
                _: '||',
                operand: [
                  { _: 'field', field: 'own', op: '==', operand: true },
                  { _: 'field', field: 'goal', op: '==', operand: true },
                ],
              },
              { _: 'field', field: 'skill.mastery', op: '<', operand: 3 },
              { _: 'field', field: 'rarity', op: '==', operand: 6 },
            ],
          },
          order: [['skill.mastery3rate.heybox', 'DESC']],
        },
      },
      'skill.mastery3rate.all.yituliu': {
        name: '一图流练度统计 技能专三率（全部）',
        query: {
          select: ['skill.mastery3rate.yituliu'],
          join: 'skill',
          where: { _: 'field', field: 'rarity', op: '==', operand: 6 },
          order: [['skill.mastery3rate.yituliu', 'DESC']],
        },
      },
      'skill.mastery3rate.all.heybox': {
        name: '小黑盒干员统计 技能专三率（全部）',
        query: {
          select: ['skill.mastery3rate.heybox'],
          join: 'skill',
          where: { _: 'field', field: 'rarity', op: '==', operand: 6 },
          order: [['skill.mastery3rate.heybox', 'DESC']],
        },
      },
    }
  }

  public getFormulaTagNames() {
    return formulaTagNames
  }

  public getItem(key: string) {
    return this.dataManager.data.items[key]
  }

  public getInventoryCategories(): Record<string, string> {
    return CategoryNames
  }

  public getInventoryPages(): Record<string, string> {
    return {
      material: '养成材料',
    }
  }

  public getInventoryItems(page?: string) {
    return Object.values(this.dataManager.data.items)
      .filter((x) => {
        if (!['MATERIAL', 'CARD_EXP', 'GOLD', '##EXP_VIRTUAL'].includes(x.raw.itemType)) return false
        if (
          [
            '3105', // 龙骨
            '3401', // 家具零件
            '3133', // 高级加固建材
            '3132', // 进阶加固建材
            '3131', // 基础加固建材
            '3114', // 碳素组
            '3113', // 碳素
            '3112', // 碳
            'STORY_REVIEW_COIN', // 事相碎片
            '3141', // 源石碎片
            '3003', // 赤金
            AK_ITEM_UNKNOWN_SHIT,
          ].includes(x.key)
        ) {
          return false
        }
        if (x.key.startsWith('act')) return false
        if (x.key.startsWith('tier')) return false
        if (x.key.startsWith('p_char')) return false
        if (x.key.startsWith('class_p_char')) return false
        return true
      })
      .sort((a, b) => {
        if (a.raw.sortId < b.raw.sortId) return -1
        if (a.raw.sortId > b.raw.sortId) return 1
        return 0
      })
      .filter((x) => {
        if (!page) return true
        if ([AK_ITEM_VIRTUAL_EXP].includes(x.key)) return false
        return ![AK_ITEM_GOLD, '4006'].includes(x.key)
      })
  }

  public getCharacter(key: string) {
    return this.dataManager.data.characters[key]
  }

  public getFormulas() {
    return this.dataManager.data.formulas
  }

  private _expItems?: Record<string, ExpItem>
  public getExpItems(): Record<string, ExpItem> {
    if (this._expItems) return this._expItems

    this._expItems = {
      [AK_ITEM_VIRTUAL_EXP]: {
        value: Object.fromEntries(
          Object.entries(this.dataManager.raw.exItems.expItems).map(([, value]) => [value.id, value.gainExp]),
        ),
        indirectStage: [
          // LS-6
          { itemId: '2003', quantity: 2 },
          { itemId: '2004', quantity: 4 },
        ],
      },
    }
    return this._expItems
  }

  private _expItemValueMap?: Map<string, [number, string]>
  public getExpItemValue(key: string): [number, string] | null | undefined {
    if (!this._expItemValueMap) {
      const allExpItems = this.getExpItems()
      const map = new Map<string, [number, string]>()
      for (const [virtualExpItemId, thisExpItem] of Object.entries(allExpItems)) {
        for (const [item, value] of Object.entries(thisExpItem.value)) {
          map.set(item, [value, virtualExpItemId])
        }
      }
      this._expItemValueMap = map
    }
    return this._expItemValueMap.get(key)
  }

  private zoneNames: Record<string, string> = {}
  private stageInfo: Record<string, ArknightsStageInfo> = undefined as any
  private cacheExpiresAt = Infinity

  public getZoneNames() {
    this.getStageInfos()
    return this.zoneNames
  }

  public getStageInfos() {
    if (this.stageInfo && Date.now() < this.cacheExpiresAt) return this.stageInfo

    const now = Date.now()
    const map = new Map<string, ArknightsStageInfo>()
    this.stageInfo = {}
    this.zoneNames = {}
    this.cacheExpiresAt = Infinity
    const loadZoneName = (stageInfo: ArknightsKengxxiao['exStage']['stages'][''], isRetro: boolean) => {
      if (this.zoneNames[stageInfo.zoneId]) return
      if (isRetro) {
        const retroId = this.dataManager.raw.exRetro.zoneToRetro[stageInfo.zoneId]
        if (retroId) {
          this.zoneNames[stageInfo.zoneId] = this.dataManager.raw.exRetro.retroActList[retroId]?.name
        }
      } else {
        const zone = this.dataManager.raw.exZone.zones[stageInfo.zoneId]
        this.zoneNames[stageInfo.zoneId] = [zone?.zoneNameFirst || '', zone?.zoneNameSecond || ''].join(' ')
      }
    }
    const matrixKeys = new Set(this.dataManager.raw.penguinMatrix.matrix.map((x) => x.stageId))
    for (const stageId of matrixKeys) {
      if (stageId.endsWith('_rep')) {
        matrixKeys.delete(stageId.slice(0, stageId.length - 4) + '_perm')
      }
    }
    for (const i of this.dataManager.raw.penguinMatrix.matrix) {
      if (!matrixKeys.has(i.stageId)) continue
      if (i.start && i.start > now) {
        this.cacheExpiresAt = Math.min(this.cacheExpiresAt, i.start)
      }
      if (i.end && i.end > now) {
        this.cacheExpiresAt = Math.min(this.cacheExpiresAt, i.end)
      }
      if (i.start > now || (i.end && i.end < now)) continue
      if (!this.dataManager.data.items[i.itemId]) continue

      let stageId = i.stageId
      if (stageId.startsWith('wk_armor_')) continue // SK-...

      let stageInfo = this.dataManager.raw.exStage.stages[stageId]
      let isRetro = false
      if (stageId.endsWith('_rep')) {
        stageId = stageId.slice(0, stageId.length - 4)
        stageInfo = this.dataManager.raw.exStage.stages[stageId]
      } else if (stageId.endsWith('_perm')) {
        stageId = stageId.slice(0, stageId.length - 5)
        stageInfo = this.dataManager.raw.exRetro.stageList[stageId]
        isRetro = true
      }
      if (!stageInfo) {
        continue
      }
      loadZoneName(stageInfo, isRetro)

      let stage = map.get(stageId)
      if (!stage) {
        stage = new ArknightsStageInfo(this, stageInfo)
        map.set(stageId, stage)
        this.stageInfo[stageId] = stage

        if (!stageInfo.apCost) console.log(stageInfo)
        stage.setAp(stageInfo.apCost)
        stage.addDrop(AK_ITEM_GOLD, stageInfo.apCost * 12)
      }

      stage.addDrop(i.itemId, i.quantity, i.times)
    }

    const makeCE = (stageId: string, gold: number) => {
      const stageInfo = this.dataManager.raw.exStage.stages[stageId]
      const stage = new ArknightsStageInfo(this, stageInfo)
      stage.setAp(stageInfo.apCost)
      stage.addDrop(AK_ITEM_GOLD, gold)
      map.set(stageId, stage)
      this.stageInfo[stageId] = stage
      loadZoneName(stageInfo, false)
    }
    makeCE('wk_melee_6', 10000)
    makeCE('wk_melee_5', 7500)
    makeCE('wk_melee_4', 5700)
    makeCE('wk_melee_3', 4100)
    makeCE('wk_melee_2', 2800)
    makeCE('wk_melee_1', 1700)

    const makeAP = (stageId: string, ticket: number) => {
      const stageInfo = this.dataManager.raw.exStage.stages[stageId]
      const stage = new ArknightsStageInfo(this, stageInfo)
      stage.setAp(stageInfo.apCost)
      stage.addDrop('4006', ticket)
      stage.addDrop(AK_ITEM_GOLD, stageInfo.apCost * 12)
      map.set(stageId, stage)
      this.stageInfo[stageId] = stage
      loadZoneName(stageInfo, false)
    }
    makeAP('wk_toxic_5', 21)

    this.zoneNames['weekly_chips'] = '芯片搜索'
    return this.stageInfo
  }
}

const diffGroupName = {
  NORMAL: '标准',
  TOUGH: '磨难',
  EASY: '剧情',
} as Record<string, string>

class ArknightsStageInfo extends BasicStageInfo {
  public constructor(
    ga: ArknightsAdapter,
    private excel: ArknightsKengxxiao['exStage']['stages'][''],
  ) {
    super(ga)
  }

  public get id(): string {
    return this.excel.stageId
  }

  public get code(): string {
    return `${diffGroupName[this.excel.diffGroup] || ''}${this.excel.code}`
  }

  public get name(): string {
    return `${this.excel.name}`
  }

  public get zoneId(): string {
    if (Object.prototype.hasOwnProperty.call(zoneReplacement, this.excel.zoneId)) {
      return zoneReplacement[this.excel.zoneId]
    }
    return this.excel.zoneId
  }

  public sortDropInfo(
    di: [itemId: string, drops: number, samples: number][],
  ): [itemId: string, drops: number, samples: number][] {
    return sortBy((i) => {
      if (i[0] === AK_ITEM_GOLD) return 1000
      if (this.ga.getExpItemValue(i[0])) {
        return 1000 + this.ga.getExpItemValue(i[0])![0]
      }
      return -(this.ga.getItem(i[0]).valueAsAp || 0) * (Number.isFinite(i[2]) ? i[1] / i[2] : i[1])
    }, di)
  }
}

const zoneReplacement: Record<string, string> = {
  weekly_1: 'weekly_chips',
  weekly_2: 'weekly_chips',
  weekly_3: 'weekly_chips',
  weekly_4: 'weekly_chips',
}

export enum Category {
  Gold = '0',
  Rarity4 = '1',
  Rarity3 = '2',
  Rarity2 = '3',
  Rarity1 = '4',
  Rarity0 = '5',
  ModSkill = '7',
  ChipsDual = '81',
  ChipsHard = '82',
  ChipsEasy = '83',
  Unknown = '9',
}

export const CategoryNames = {
  [Category.Gold]: '钱和经验',
  [Category.Rarity4]: '金材料',
  [Category.Rarity3]: '紫材料',
  [Category.Rarity2]: '蓝材料',
  [Category.Rarity1]: '绿材料',
  [Category.Rarity0]: '灰材料',
  [Category.ModSkill]: '技能、模组和胶水',
  [Category.ChipsDual]: '双芯片',
  [Category.ChipsHard]: '芯片组',
  [Category.ChipsEasy]: '芯片',
  [Category.Unknown]: '其他',
} satisfies Record<Category, string>

export const myCategories = {
  '4001': Category.Gold, // 龙门币
  [AK_ITEM_VIRTUAL_EXP]: Category.Gold,
  '2004': Category.Gold, // 高级作战记录
  '2003': Category.Gold, // 中级作战记录
  '2002': Category.Gold, // 初级作战记录
  '2001': Category.Gold, // 基础作战记录

  '3303': Category.ModSkill, // 技巧概要·卷3
  '3302': Category.ModSkill, // 技巧概要·卷2
  '3301': Category.ModSkill, // 技巧概要·卷1
  mod_unlock_token: Category.ModSkill, // 模组数据块
  mod_update_token_2: Category.ModSkill, // 数据增补仪
  mod_update_token_1: Category.ModSkill, // 数据增补条
  '4006': Category.Gold, // 采购凭证
  '32001': Category.ModSkill, // 芯片助剂

  '3213': Category.ChipsDual, // 先锋双芯片
  '3223': Category.ChipsDual, // 近卫双芯片
  '3233': Category.ChipsDual, // 重装双芯片
  '3243': Category.ChipsDual, // 狙击双芯片
  '3253': Category.ChipsDual, // 术师双芯片
  '3263': Category.ChipsDual, // 医疗双芯片
  '3273': Category.ChipsDual, // 辅助双芯片
  '3283': Category.ChipsDual, // 特种双芯片

  '3212': Category.ChipsHard, // 先锋芯片组
  '3222': Category.ChipsHard, // 近卫芯片组
  '3232': Category.ChipsHard, // 重装芯片组
  '3242': Category.ChipsHard, // 狙击芯片组
  '3252': Category.ChipsHard, // 术师芯片组
  '3262': Category.ChipsHard, // 医疗芯片组
  '3272': Category.ChipsHard, // 辅助芯片组
  '3282': Category.ChipsHard, // 特种芯片组

  '3211': Category.ChipsEasy, // 先锋芯片
  '3221': Category.ChipsEasy, // 近卫芯片
  '3231': Category.ChipsEasy, // 重装芯片
  '3241': Category.ChipsEasy, // 狙击芯片
  '3251': Category.ChipsEasy, // 术师芯片
  '3261': Category.ChipsEasy, // 医疗芯片
  '3271': Category.ChipsEasy, // 辅助芯片
  '3281': Category.ChipsEasy, // 特种芯片
} satisfies Record<string, Category>
