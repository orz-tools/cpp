import deepEqual from 'deep-equal'
import { sortBy } from 'ramda'
import { GameName } from '../../games'
import {
  Assertion,
  BasicStageInfo,
  ExpItem,
  IGameAdapter,
  IGameAdapterStatic,
  IStageCategory,
  IZoneInfo,
  PredefinedQuery,
  PredefinedQueryGroup,
  PredefinedQuerySegment,
  QNumber,
  QString,
  QStrings,
  QueryParam,
  RootCharacterQuery,
} from '../cpp-basic'
import { PSTR, gt, lpstr } from '../gt'
import { ArknightsDataManager, Character } from './DataManager'
import { ArknightsUserDataAdapter } from './UserDataAdapter'
import {
  DEFAULT_ITEM_VALUE_CONFIG,
  ItemValueConfig,
  ItemValueGameInputs,
  ItemValueResult,
  checkStageAssembly,
  computeArknightsItemValues,
  exportItemValueGameInputs,
  normalizeItemValueConfig,
} from './itemValue'
import { EnemyLevel, MissionCatalog, MissionModule, MissionStageInfo } from './moduleMissions'
import { SkinCatalog, buildSkinCatalog } from './skins'
import { HeyboxSurveySource, YituliuSurveySource, toTierShares } from './survey'
import { TrainingCost } from './trainingCost'
import {
  AK_FIXED_DROP_STAGES,
  AK_ITEM_GOLD,
  AK_ITEM_UNKNOWN_SHIT,
  AK_ITEM_VIRTUAL_EXP,
  Arknights,
  ArknightsKengxxiao,
  ArknightsRegion,
  PreferenceKeys,
  ProfessionNames,
  SurveySourceKeys,
  formulaTagNames,
} from './types'
import {
  ArknightsStageCategory,
  arknightsChapterLabel,
  arknightsChapterOf,
  arknightsZoneCategory,
  arknightsZoneSortKey,
} from './zones'

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i)
const numberOptions = (from: number, to: number) => () => range(from, to).map((x) => ({ value: x, label: `${x}` }))
const rarityOptions = numberOptions(1, 6)
const potentialOptions = numberOptions(1, 6)
const skillLevelOptions = numberOptions(1, 7)
const eliteOptions = () =>
  range(0, 2).map((x) => ({ value: x, label: gt.pgettext('query value', '精英 %d').replaceAll('%d', `${x}`) }))
const masteryOptions = () =>
  range(0, 3).map((x) => ({ value: x, label: gt.pgettext('query value', '专精 %d').replaceAll('%d', `${x}`) }))
const professionOptions = () => Object.entries(ProfessionNames).map(([value, label]) => ({ value, label }))

const allSegment = (
  key: string,
  title: PSTR = lpstr(() => gt.pgettext('query menu', '不论持有和练度，列出全部')),
): PredefinedQuerySegment => ({ key, label: lpstr(() => gt.pgettext('query menu', '全部')), title })

const usableSegment = (key: string, title: PSTR): PredefinedQuerySegment => ({
  key,
  label: lpstr(() => gt.pgettext('query menu', '能用')),
  title,
})

export class ArknightsAdapter implements IGameAdapter<Arknights> {
  public readPreference<K extends keyof Arknights['preferences']>(
    key: K,
    storage: Record<string, any>,
  ): Arknights['preferences'][K] {
    if (key === PreferenceKeys.SurveySource) {
      const value = storage[PreferenceKeys.SurveySource]
      return (SurveySourceKeys.includes(value) ? value : SurveySourceKeys[0]) as Arknights['preferences'][K]
    }
    if (key === PreferenceKeys.ItemValue) {
      return normalizeItemValueConfig(storage[PreferenceKeys.ItemValue]) as Arknights['preferences'][K]
    }
    if (key === PreferenceKeys.ShowPotential) {
      return (storage[PreferenceKeys.ShowPotential] !== false) as Arknights['preferences'][K]
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
    if (key === PreferenceKeys.ItemValue) {
      return {
        ...storage,
        [key]: normalizeItemValueConfig(value),
      }
    }
    if (key === PreferenceKeys.ShowPotential) {
      return {
        ...storage,
        [key]: value === true,
      }
    }
    return storage
  }

  private itemValueConfig: ItemValueConfig = normalizeItemValueConfig(DEFAULT_ITEM_VALUE_CONFIG)
  private itemValues?: ItemValueResult

  public applyPreferenceSnapshot(storage: Record<string, any>) {
    const config = normalizeItemValueConfig(storage[PreferenceKeys.ItemValue])
    if (deepEqual(config, this.itemValueConfig)) return false
    // The values computed for the old config stay until the rebuild this asks for drops them with the rest.
    this.itemValueConfig = config
    return true
  }

  public getItemValueConfig(): ItemValueConfig {
    return this.itemValueConfig
  }

  public getItemValues(): ItemValueResult {
    return (this.itemValues ||= computeArknightsItemValues(this, this.itemValueConfig))
  }

  private itemValueGameInputs?: { containers: unknown[]; inputs: ItemValueGameInputs }

  /** Kept across commits while the game data containers stay the same, as when only the penguin matrix changed. */
  public exportItemValueGameInputs(): ItemValueGameInputs {
    const dm = this.dataManager
    const containers = [dm.get(dm.$kengxxiao), dm.$kengxxiaoLocal ? dm.get(dm.$kengxxiaoLocal) : null]
    const cached = this.itemValueGameInputs
    if (cached && cached.containers.every((x, i) => x === containers[i])) return cached.inputs
    const inputs = exportItemValueGameInputs(this)
    this.itemValueGameInputs = { containers, inputs }
    return inputs
  }

  public checkStageAssembly() {
    return checkStageAssembly(this)
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

  public constructor() {
    this.dataManager.itemValueProvider = () => this.getItemValues()
    this.dataManager.onCommit(() => this.onDataCommit())
  }

  private onDataCommit() {
    this.itemValues = undefined
    this._expItems = undefined
    this._expItemValueMap = undefined
    this.stageInfo = undefined
    this.zoneNames = {}
    this.zoneTypes = {}
    this.zoneInfos = undefined
    this.missionCatalog = undefined
    this.trainingCost = undefined
    this.skinCatalog = undefined
    this.cacheExpiresAt = Infinity
    this.getStageInfos()
    return Number.isFinite(this.cacheExpiresAt) ? this.cacheExpiresAt : undefined
  }

  public static codename: string = GameName.Arknights
  public getCodename(): string {
    return ArknightsAdapter.codename
  }

  public static getRegions() {
    return [
      { id: ArknightsRegion.zh_CN, name: 'CN (Simplified Chinese)', short: 'CN' },
      { id: ArknightsRegion.en_US, name: 'YoStarEN (English)', short: 'EN' },
      { id: ArknightsRegion.ja_JP, name: 'YoStarJP (Japanese)', short: 'JP' },
      { id: ArknightsRegion.ko_KR, name: 'YoStarKR (Korean)', short: 'KR' },
      // { id: ArknightsRegion.zh_TW, name: 'txwy (Traditional Chinese)', short: 'KR' },
    ]
  }

  public getDataManager() {
    return this.dataManager
  }

  public getUserDataAdapter() {
    return this.userDataAdapter
  }

  private rootCharacterQuery = new RootCharacterQuery<Arknights, Character>().tap((aa) => {
    aa.addField(
      'name',
      lpstr(() => gt.pgettext('query field', '代号')),
      QString,
      ({ character }) => character.name,
    )
    aa.addField(
      'code',
      lpstr(() => gt.pgettext('query field', '西文代号')),
      QString,
      ({ character }) => character.appellation,
    )
      .addAlias('appellation')
      .addAlias('en')
    aa.addField(
      'rarity',
      lpstr(() => gt.pgettext('query field', '稀有度')),
      QNumber,
      ({ character }) => character.rarity + 1,
    )
      .addAlias('star')
      .withOptions(rarityOptions)
    aa.addField(
      'profession',
      lpstr(() => gt.pgettext('query field', '主职业')),
      QString,
      ({ character }) => character.raw.profession,
    ).withOptions(professionOptions)
    aa.addField(
      'professions',
      lpstr(() => gt.pgettext('query field', '职业')),
      QStrings,
      ({ character }) => [...new Set([character.raw.profession, ...character.patches.map((x) => x[1].profession)])],
    ).withOptions(professionOptions)

    aa.addStatusField(
      'elite',
      lpstr(() => gt.pgettext('query field', '精英化')),
      QNumber,
      ({ status }) => status.elite,
    ).withOptions(eliteOptions)
    aa.addStatusField(
      'level',
      lpstr(() => gt.pgettext('query field', '等级')),
      QNumber,
      ({ status }) => status.level,
    )
    aa.addStatusField(
      'elv',
      lpstr(() => gt.pgettext('query field', '精英化 × 100 + 等级')),
      QNumber,
      ({ status }) => status.elite * 100 + status.level,
    )
    aa.addStatusField(
      'skillLevel',
      lpstr(() => gt.pgettext('query field', '技能等级')),
      QNumber,
      ({ status }) => status.skillLevel,
    ).withOptions(skillLevelOptions)
    aa.addStatusField(
      'potential',
      lpstr(() => gt.pgettext('query field', '潜能')),
      QNumber,
      ({ status }) => (status.potentialRank || 0) + 1,
    ).withOptions(potentialOptions)

    const hss = new HeyboxSurveySource(this.dataManager)
    const yss = new YituliuSurveySource(this.dataManager)

    aa.addField(
      'elite2rate.yituliu',
      lpstr(() => gt.pgettext('query field', '一图流练度统计 精二率')),
      QNumber,
      ({ character }) => {
        return QNumber.parse(yss.elite2(character)?.percent)
      },
    ).withFormat('percent')

    aa.addField(
      'elite2rate.heybox',
      lpstr(() => gt.pgettext('query field', '小黑盒干员统计 精二率')),
      QNumber,
      ({ character }) => {
        return QNumber.parse(hss.elite2(character)?.percent)
      },
    ).withFormat('percent')

    aa.addField(
      'elite2level90rate.heybox',
      lpstr(() => gt.pgettext('query field', '小黑盒干员统计 精二 90 级率')),
      QNumber,
      ({ character }) => {
        return QNumber.parse(hss.e2level(character, 90)?.percent)
      },
    ).withFormat('percent')

    aa.addField(
      'cost.elite2',
      lpstr(() => gt.pgettext('query field', '精二直升价值')),
      QNumber,
      ({ character, current }) => this.getTrainingCost().elite2Saving(character, current)?.value ?? NaN,
    )

    aa.addField(
      'cost.invested',
      lpstr(() => gt.pgettext('query field', '已投入')),
      QNumber,
      ({ character, current }) => this.getTrainingCost().invested(character, current)?.value ?? NaN,
    )

    aa.createSubQuery(
      'skill',
      lpstr(() => gt.pgettext('query sub query', '技能')),
      (character) => {
        return character.skills.map((_, index) => [index] as const)
      },
      (index) => `${index}`,
    ).tap((sq) => {
      sq.addField(
        'name',
        lpstr(() => gt.pgettext('query field', '技能名')),
        QString,
        ({ character, args: [index] }) => character.skills[index].skill.name,
      )

      sq.addStatusField(
        'mastery',
        lpstr(() => gt.pgettext('query field', '专精等级')),
        QNumber,
        ({ character, status, args: [index] }) => {
          return status.skillMaster[character.skills[index].skillId] ?? 0
        },
      ).withOptions(masteryOptions)

      sq.addField(
        'mastery3rate.yituliu',
        lpstr(() => gt.pgettext('query field', '一图流练度统计 技能专三率')),
        QNumber,
        ({ character, args: [index] }) => {
          const s = yss.skill(
            character,
            character.skills[index].skill,
            character.skills[index].rawCharId,
            character.skills[index].charSkillIndex,
          )
          return toTierShares(s)?.shares[3] ?? NaN
        },
      ).withFormat('percent')

      sq.addField(
        'mastery3rate.heybox',
        lpstr(() => gt.pgettext('query field', '小黑盒干员统计 技能专三率')),
        QNumber,
        ({ character, args: [index] }) => {
          const s = hss.skill(
            character,
            character.skills[index].skill,
            character.skills[index].rawCharId,
            character.skills[index].charSkillIndex,
          )
          return toTierShares(s)?.shares[3] ?? NaN
        },
      ).withFormat('percent')

      sq.addField(
        'cost.mastery3',
        lpstr(() => gt.pgettext('query field', '专三价值')),
        QNumber,
        ({ character, current, args: [index] }) => {
          const saving = this.getTrainingCost().mastery3Saving(character, current, index)
          if (!saving) return NaN
          // A mastery that costs nothing is 0 even while the values are unknown, so the presets can drop it with `!= 0`
          return saving.items.size === 0 ? 0 : saving.value
        },
      )
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

  public getPredefinedQueryGroups(): PredefinedQueryGroup[] {
    return [
      { id: 'stats', title: lpstr(() => gt.pgettext('query menu', '练度统计')) },
      { id: 'cost', title: lpstr(() => gt.pgettext('query menu', '养成成本')) },
    ]
  }

  public getPredefinedQueries(): Record<string, PredefinedQuery> {
    // 直升道具只有 4–6 星的；道具分星级，所以先按星级排
    const voucherRarity: Assertion = { _: 'field', field: 'rarity', op: '>=', operand: 4 }
    const own: Assertion = { _: 'field', field: 'own', op: '==', operand: true }
    const elite2Order: QueryParam['order'] = [
      ['rarity', 'DESC'],
      ['cost.elite2', 'DESC'],
    ]
    const mastery3Order: QueryParam['order'] = [
      ['rarity', 'DESC'],
      ['skill.cost.mastery3', 'DESC'],
    ]
    const costsMaterials: Assertion = { _: 'field', field: 'skill.cost.mastery3', op: '!=', operand: 0 }

    return {
      'skill.mastery3rate.yituliu': {
        name: gt.pgettext('predefined query', '一图流 技能专三率'),
        group: 'stats',
        segments: [allSegment('skill.mastery3rate.all.yituliu')],
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
      'skill.mastery3rate.all.yituliu': {
        name: gt.pgettext('predefined query', '一图流 技能专三率（全部）'),
        group: 'stats',
        query: {
          select: ['skill.mastery3rate.yituliu'],
          join: 'skill',
          where: { _: 'field', field: 'rarity', op: '==', operand: 6 },
          order: [['skill.mastery3rate.yituliu', 'DESC']],
        },
      },
      'skill.mastery3rate.heybox': {
        name: gt.pgettext('predefined query', '小黑盒 技能专三率'),
        group: 'stats',
        segments: [allSegment('skill.mastery3rate.all.heybox')],
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
      'skill.mastery3rate.all.heybox': {
        name: gt.pgettext('predefined query', '小黑盒 技能专三率（全部）'),
        group: 'stats',
        query: {
          select: ['skill.mastery3rate.heybox'],
          join: 'skill',
          where: { _: 'field', field: 'rarity', op: '==', operand: 6 },
          order: [['skill.mastery3rate.heybox', 'DESC']],
        },
      },
      'elite2rate.yituliu': {
        name: gt.pgettext('predefined query', '一图流 精二率'),
        group: 'stats',
        segments: [allSegment('elite2rate.all.yituliu')],
        query: {
          select: ['elite2rate.yituliu'],
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
              { _: 'field', field: 'elite', op: '<', operand: 2 },
              { _: 'field', field: 'rarity', op: '==', operand: 6 },
            ],
          },
          order: [['elite2rate.yituliu', 'DESC']],
        },
      },
      'elite2rate.all.yituliu': {
        name: gt.pgettext('predefined query', '一图流 精二率（全部）'),
        group: 'stats',
        query: {
          select: ['elite2rate.yituliu'],
          where: { _: 'field', field: 'rarity', op: '==', operand: 6 },
          order: [['elite2rate.yituliu', 'DESC']],
        },
      },
      'elite2rate.heybox': {
        name: gt.pgettext('predefined query', '小黑盒 精二率'),
        group: 'stats',
        segments: [allSegment('elite2rate.all.heybox')],
        query: {
          select: ['elite2rate.heybox'],
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
              { _: 'field', field: 'elite', op: '<', operand: 2 },
              { _: 'field', field: 'rarity', op: '==', operand: 6 },
            ],
          },
          order: [['elite2rate.heybox', 'DESC']],
        },
      },
      'elite2rate.all.heybox': {
        name: gt.pgettext('predefined query', '小黑盒 精二率（全部）'),
        group: 'stats',
        query: {
          select: ['elite2rate.heybox'],
          where: { _: 'field', field: 'rarity', op: '==', operand: 6 },
          order: [['elite2rate.heybox', 'DESC']],
        },
      },
      'elite2level90rate.heybox': {
        name: gt.pgettext('predefined query', '小黑盒 精二 90 级率'),
        group: 'stats',
        segments: [allSegment('elite2level90rate.all.heybox')],
        query: {
          select: ['elite2level90rate.heybox'],
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
              { _: 'field', field: 'elite', op: '==', operand: 2 },
              { _: 'field', field: 'level', op: '<', operand: 90 },
              { _: 'field', field: 'rarity', op: '==', operand: 6 },
            ],
          },
          order: [['elite2level90rate.heybox', 'DESC']],
        },
      },
      'elite2level90rate.all.heybox': {
        name: gt.pgettext('predefined query', '小黑盒 精二 90 级率（全部）'),
        group: 'stats',
        query: {
          select: ['elite2level90rate.heybox'],
          where: { _: 'field', field: 'rarity', op: '==', operand: 6 },
          order: [['elite2level90rate.heybox', 'DESC']],
        },
      },
      'cost.elite2': {
        name: gt.pgettext('predefined query', '精二直升价值'),
        group: 'cost',
        title: lpstr(() => gt.pgettext('query menu', '计划练到精二、现在还没精二的')),
        segments: [
          usableSegment(
            'cost.elite2.usable',
            lpstr(() => gt.pgettext('query menu', '已持有、还没精二的，不看计划')),
          ),
          allSegment(
            'cost.elite2.all',
            lpstr(() => gt.pgettext('query menu', '全部 4–6 星干员')),
          ),
        ],
        query: {
          select: ['cost.elite2'],
          where: {
            _: '&&',
            operand: [
              voucherRarity,
              { _: 'field', field: 'goal.elite', op: '==', operand: 2 },
              { _: 'field', field: 'elite', op: '<', operand: 2 },
            ],
          },
          order: elite2Order,
        },
      },
      'cost.elite2.usable': {
        name: gt.pgettext('predefined query', '精二直升价值（能用）'),
        group: 'cost',
        query: {
          select: ['cost.elite2'],
          where: {
            _: '&&',
            operand: [voucherRarity, own, { _: 'field', field: 'elite', op: '<', operand: 2 }],
          },
          order: elite2Order,
        },
      },
      'cost.elite2.all': {
        name: gt.pgettext('predefined query', '精二直升价值（全部）'),
        group: 'cost',
        query: {
          select: ['cost.elite2'],
          where: voucherRarity,
          order: elite2Order,
        },
      },
      'skill.cost.mastery3': {
        name: gt.pgettext('predefined query', '专三价值'),
        group: 'cost',
        title: lpstr(() => gt.pgettext('query menu', '计划专三、现在还没专三的技能')),
        segments: [
          usableSegment(
            'skill.cost.mastery3.usable',
            lpstr(() => gt.pgettext('query menu', '已持有、精二、技能 7 级，还没专三的技能，不看计划')),
          ),
          allSegment(
            'skill.cost.mastery3.all',
            lpstr(() => gt.pgettext('query menu', '全部 4–6 星干员的技能')),
          ),
        ],
        query: {
          select: ['skill.cost.mastery3'],
          join: 'skill',
          where: {
            _: '&&',
            operand: [
              voucherRarity,
              { _: 'field', field: 'skill.goal.mastery', op: '==', operand: 3 },
              { _: 'field', field: 'skill.mastery', op: '<', operand: 3 },
              costsMaterials,
            ],
          },
          order: mastery3Order,
        },
      },
      'skill.cost.mastery3.usable': {
        name: gt.pgettext('predefined query', '专三价值（能用）'),
        group: 'cost',
        query: {
          select: ['skill.cost.mastery3'],
          join: 'skill',
          where: {
            _: '&&',
            operand: [
              voucherRarity,
              own,
              { _: 'field', field: 'elite', op: '==', operand: 2 },
              { _: 'field', field: 'skillLevel', op: '==', operand: 7 },
              { _: 'field', field: 'skill.mastery', op: '<', operand: 3 },
              costsMaterials,
            ],
          },
          order: mastery3Order,
        },
      },
      'skill.cost.mastery3.all': {
        name: gt.pgettext('predefined query', '专三价值（全部）'),
        group: 'cost',
        query: {
          select: ['skill.cost.mastery3'],
          join: 'skill',
          where: { _: '&&', operand: [voucherRarity, costsMaterials] },
          order: mastery3Order,
        },
      },
      'cost.invested': {
        name: gt.pgettext('predefined query', '已投入'),
        group: 'cost',
        title: lpstr(() => gt.pgettext('query menu', '已持有的干员，从精零 1 级练到现在花了多少')),
        totalValue: 'cost.invested',
        query: {
          select: ['cost.invested'],
          where: own,
          order: [['cost.invested', 'DESC']],
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

  public getInventoryCategories(): Record<string, PSTR> {
    return CategoryNames
  }

  public getInventoryPages(): Record<string, string> {
    return {
      material: gt.pgettext('arknights inventory page', '养成材料'),
    }
  }

  public getInventoryItems(page?: string) {
    return Object.values(this.dataManager.data.items)
      .filter((x) => {
        if (!['MATERIAL', 'CARD_EXP', 'GOLD', '##EXP_VIRTUAL'].includes(String(x.raw.itemType))) return false
        // 活动纪念品的 itemType 可以是 MATERIAL，id 也不一定以 act 开头，如 ark_odc_act53side_spitem_1
        if (x.raw.classifyType === 'MEMENTO') return false
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

  public getEnemy(id: string): { name: string; level: EnemyLevel } | undefined {
    const raw = this.dataManager.raw.exEnemies.enemyData[id]
    if (!raw) return undefined
    const local = this.dataManager.raw.local?.exEnemies?.enemyData[id]
    return { name: local?.name || raw.name, level: raw.enemyLevel }
  }

  /** 数据 worker 发布模组任务之前的缓存数据里没有 */
  public hasModuleMissions(): boolean {
    return Object.keys(this.dataManager.raw.exUniEquips.missionList ?? {}).length > 0
  }

  private missionCatalog?: MissionCatalog
  public getMissionCatalog(): MissionCatalog {
    return (this.missionCatalog ||= this.buildMissionCatalog())
  }

  private buildMissionCatalog(): MissionCatalog {
    const raw = this.dataManager.raw
    const uda = this.userDataAdapter
    const empty = uda.getFrozenEmptyCharacterStatus()
    const modules: MissionModule[] = []
    for (const charId of uda.getAllCharacterIds()) {
      const c = this.getCharacter(charId)
      const seen = new Set<string>()
      for (const { equip } of c.uniEquips) {
        if (seen.has(equip.key) || equip.missions.length === 0) continue
        seen.add(equip.key)
        const formId = equip.formId
        modules.push({
          equipId: equip.key,
          charId,
          stars: c.rarity + 1,
          unlockLevel: c.modUnlockLevel,
          missions: equip.missions.map((m) => ({
            id: m.id,
            template: m.template,
            paramList: m.paramList,
            stageId: m.stageId,
            desc: m.desc,
            equipId: equip.key,
            charId,
            formId,
            profession: c.getPatchProfession(formId),
            position: c.getPatchPosition(formId),
            stars: c.rarity + 1,
          })),
        })
      }
    }

    const stages = new Map<string, MissionStageInfo>()
    const readStage = (stageId: string): MissionStageInfo => {
      // 国际服还没开的活动关卡，退回国服的数据
      const base = raw.local?.exStage.stages[stageId] ? raw.local : raw
      const excel = base.exStage.stages[stageId]
      if (!excel) return { id: stageId, code: stageId, name: '', apCost: 0, zoneName: '' }
      const zone = base.exZone.zones[excel.zoneId]
      const retroId = base.exRetro.zoneToRetro[excel.zoneId]
      const zoneName = zone
        ? [zone.zoneNameFirst, zone.zoneNameSecond].filter(Boolean).join(' ')
        : retroId
          ? (base.exRetro.retroActList[retroId]?.name ?? '')
          : ''
      return { id: stageId, code: excel.code ?? stageId, name: excel.name ?? '', apCost: excel.apCost, zoneName }
    }

    return {
      modules,
      world: { enemyLevel: (id) => raw.exEnemies.enemyData[id]?.enemyLevel },
      stage: (stageId) => {
        let info = stages.get(stageId)
        if (!info) stages.set(stageId, (info = readStage(stageId)))
        return info
      },
      isOwned: (charId, status) => !uda.isAbsentCharacter(this.getCharacter(charId), status ?? empty),
    }
  }

  // A change to the item value settings rebuilds the game data too, so the costs never use stale values.
  private trainingCost?: TrainingCost
  public getTrainingCost(): TrainingCost {
    return (this.trainingCost ||= new TrainingCost(this))
  }

  /** 数据 worker 发布时装之前的缓存数据里没有；国际服看自己区服的表 */
  public hasSkins(): boolean {
    const raw = this.dataManager.raw
    return Object.keys((raw.local ?? raw).exSkin?.charSkins ?? {}).length > 0
  }

  private skinCatalog?: SkinCatalog
  public getSkinCatalog(): SkinCatalog {
    const raw = this.dataManager.raw
    return (this.skinCatalog ||= buildSkinCatalog({ base: raw.exSkin, local: raw.local?.exSkin ?? null }))
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

  private zoneNames: Record<string, [first: string, second: string]> = {}
  private zoneTypes: Record<string, string | undefined> = {}
  private zoneInfos: Record<string, IZoneInfo> | undefined
  private stageInfo: Record<string, ArknightsStageInfo> | undefined
  private cacheExpiresAt = Infinity

  public getZoneInfos() {
    const stageInfo = this.getStageInfos()
    if (this.zoneInfos) return this.zoneInfos

    const codes: Record<string, string[]> = {}
    for (const stage of Object.values(stageInfo)) {
      ;(codes[stage.zoneId] ||= []).push(stage.code)
    }
    // From chapter 15 on, the first part of a main story name is an English subtitle instead of the chapter number
    let template: [chapter: number, label: string] | undefined
    for (const [id, [first]] of Object.entries(this.zoneNames)) {
      const m = /^main_(\d+)$/.exec(id)
      if (!m || !first || this.zoneTypes[id] !== 'MAINLINE') continue
      const chapter = Number(m[1])
      if (!template || chapter > template[0]) template = [chapter, first]
    }

    const zoneInfos: Record<string, IZoneInfo> = {}
    for (const [id, stageCodes] of Object.entries(codes)) {
      const type = this.zoneTypes[id]
      const [first, second] = this.zoneNames[id] || ['', '']
      const joined = [first, second].filter((x) => x).join(' ')
      let name = joined
      let shortName = joined
      if (type === 'MAINLINE') {
        shortName = first || second
      } else if (type === 'MAINLINE_ACTIVITY' || type === 'MAINLINE_RETRO') {
        const chapter = arknightsChapterOf(stageCodes)
        const label =
          template && chapter !== undefined ? arknightsChapterLabel(template[1], template[0], chapter) : undefined
        if (label) {
          name = [label, second].filter((x) => x).join(' ')
          shortName = label
        }
      }
      const info = {
        id,
        name,
        shortName,
        categoryId: arknightsZoneCategory(type),
        sortKey: arknightsZoneSortKey(id, type, stageCodes),
      }
      // Our own name rather than one from the game data, so it follows the UI language, which changes without a rebuild.
      zoneInfos[id] =
        id === 'weekly_chips'
          ? {
              ...info,
              get name() {
                return gt.pgettext('arknights zone', '芯片搜索')
              },
              get shortName() {
                return gt.pgettext('arknights zone', '芯片搜索')
              },
            }
          : info
    }
    this.zoneInfos = zoneInfos
    return zoneInfos
  }

  public getStageCategories(): IStageCategory[] {
    return [
      { id: ArknightsStageCategory.Main, name: gt.pgettext('arknights stage category', '主线') },
      { id: ArknightsStageCategory.Activity, name: gt.pgettext('arknights stage category', '活动') },
      { id: ArknightsStageCategory.Sidestory, name: gt.pgettext('arknights stage category', '别传') },
      { id: ArknightsStageCategory.Branchline, name: gt.pgettext('arknights stage category', '插曲') },
      { id: ArknightsStageCategory.Resource, name: gt.pgettext('arknights stage category', '资源收集') },
      { id: ArknightsStageCategory.Other, name: gt.pgettext('arknights stage category', '其他') },
    ]
  }

  public getStageInfos() {
    // Rebuilt only on a commit: rebuilding here when an event starts or ends would swap the stages within a
    // generation while the item values computed from them stayed.
    if (this.stageInfo) return this.stageInfo

    const base = this.dataManager.raw.local || this.dataManager.raw
    const now = Date.now()
    const map = new Map<string, ArknightsStageInfo>()
    this.stageInfo = {}
    this.zoneNames = {}
    this.zoneTypes = {}
    this.zoneInfos = undefined
    this.cacheExpiresAt = Infinity
    const loadZoneName = (stageInfo: ArknightsKengxxiao['exStage']['stages'][''], isRetro: boolean) => {
      if (this.zoneNames[stageInfo.zoneId]) return
      this.zoneTypes[stageInfo.zoneId] = base.exZone.zones[stageInfo.zoneId]?.type
      if (isRetro) {
        const retroId = base.exRetro.zoneToRetro[stageInfo.zoneId]
        if (retroId) {
          this.zoneNames[stageInfo.zoneId] = ['', base.exRetro.retroActList[retroId]?.name?.trim() || '']
        }
      } else {
        const zone = base.exZone.zones[stageInfo.zoneId]
        this.zoneNames[stageInfo.zoneId] = [zone?.zoneNameFirst?.trim() || '', zone?.zoneNameSecond?.trim() || '']
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

      let stageInfo = base.exStage.stages[stageId]
      let isRetro = false
      if (stageId.endsWith('_rep')) {
        stageId = stageId.slice(0, stageId.length - 4)
        stageInfo = base.exStage.stages[stageId]
      } else if (stageId.endsWith('_perm')) {
        stageId = stageId.slice(0, stageId.length - 5)
        stageInfo = base.exRetro.stageList[stageId]
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

    for (const fixed of AK_FIXED_DROP_STAGES) {
      const stageInfo = this.dataManager.raw.exStage.stages[fixed.stageId]
      const stage = new ArknightsStageInfo(this, stageInfo)
      stage.setAp(stageInfo.apCost)
      for (const [itemId, quantity] of Object.entries(fixed.drops)) stage.addDrop(itemId, quantity)
      if (fixed.apGold) stage.addDrop(AK_ITEM_GOLD, stageInfo.apCost * 12)
      map.set(fixed.stageId, stage)
      this.stageInfo[fixed.stageId] = stage
      loadZoneName(stageInfo, false)
    }

    this.zoneTypes['weekly_chips'] = 'WEEKLY'
    return this.stageInfo
  }
}

const diffGroupName = {
  NORMAL: lpstr(() => gt.pgettext('arknights stage difficulty', '标准')),
  TOUGH: lpstr(() => gt.pgettext('arknights stage difficulty', '磨难')),
  EASY: lpstr(() => gt.pgettext('arknights stage difficulty', '剧情')),
} as Record<string, PSTR>

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

  // 游戏里的关卡代号，不带难度前缀
  public get rawCode(): string {
    return this.excel.code ?? ''
  }

  public get code(): string {
    return `${(diffGroupName[this.excel.diffGroup] || '').toString()}${this.excel.code ?? ''}`
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

;(function (t: IGameAdapterStatic) {
  return t
})(ArknightsAdapter)

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
  [Category.Gold]: lpstr(() => gt.pgettext('arknights item category', '钱和经验')),
  [Category.Rarity4]: lpstr(() => gt.pgettext('arknights item category', '金材料')),
  [Category.Rarity3]: lpstr(() => gt.pgettext('arknights item category', '紫材料')),
  [Category.Rarity2]: lpstr(() => gt.pgettext('arknights item category', '蓝材料')),
  [Category.Rarity1]: lpstr(() => gt.pgettext('arknights item category', '绿材料')),
  [Category.Rarity0]: lpstr(() => gt.pgettext('arknights item category', '灰材料')),
  [Category.ModSkill]: lpstr(() => gt.pgettext('arknights item category', '技能、模组和胶水')),
  [Category.ChipsDual]: lpstr(() => gt.pgettext('arknights item category', '双芯片')),
  [Category.ChipsHard]: lpstr(() => gt.pgettext('arknights item category', '芯片组')),
  [Category.ChipsEasy]: lpstr(() => gt.pgettext('arknights item category', '芯片')),
  [Category.Unknown]: lpstr(() => gt.pgettext('arknights item category', '其他')),
} satisfies Record<Category, PSTR>

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
