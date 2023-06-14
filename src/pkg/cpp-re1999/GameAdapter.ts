import { sortBy } from 'ramda'
import { BasicStageInfo, ExpItem, IGameAdapter } from '../cpp-basic'
import {
  Re1999DataManager,
  Character,
  formulaTagNames,
  RE_ITEM_EXP,
  RE_ITEM_GOLD,
  CurrencyItem,
  Item,
  parseConsume,
} from './DataManager'
import { Re1999UserDataAdapter } from './UserDataAdapter'
import { ExChapter, ExChapterType, ExEpisode, ExEpisodeType, Re1999, Re1999CharacterStatus } from './types'

export class Re1999Adapter implements IGameAdapter<Re1999> {
  dataManager = new Re1999DataManager()
  userDataAdapter = new Re1999UserDataAdapter(this.dataManager)

  static codename: string = 'reverse1999'
  getCodename(): string {
    return Re1999Adapter.codename
  }

  getDataManager() {
    return this.dataManager
  }

  getUserDataAdapter() {
    return this.userDataAdapter
  }

  getFormulaTagNames() {
    return formulaTagNames
  }

  getItem(key: string) {
    return this.dataManager.data.items[key]
  }

  getInventoryCategories(): Record<string, string> {
    return CategoryNames
  }

  getInventoryItems() {
    return Object.values(this.dataManager.data.items)
      .map((x) => x as Item | CurrencyItem)
      .filter((x) => {
        if ([RE_ITEM_EXP, RE_ITEM_GOLD].includes(x.key)) return true
        if (x.isCurrency) return false
        if (![11, 12].includes(x.raw.subType)) return false
        return true
      })
      .sort((a, b) => {
        if (a.sortId < b.sortId) return -1
        if (a.sortId > b.sortId) return 1
        return 0
      })
  }

  getCharacter(key: string) {
    return this.dataManager.data.characters[key]
  }

  getFormulas() {
    return this.dataManager.data.formulas
  }

  getExpItems(): Record<string, ExpItem> {
    return {}
  }

  _expItemValueMap?: Map<string, [number, string]>
  getExpItemValue(key: string): [number, string] | null | undefined {
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

  zoneNames: Record<string, string> = {}
  stageInfo: Record<string, Re1999StageInfo> = undefined as any
  cacheExpiresAt: number = Infinity

  getZoneNames() {
    this.getStageInfos()
    return this.zoneNames
  }

  getStageInfos() {
    if (this.stageInfo && Date.now() < this.cacheExpiresAt) return this.stageInfo

    const now = Date.now()
    const map = new Map<string, Re1999StageInfo>()
    this.stageInfo = {}
    this.zoneNames = {}
    this.cacheExpiresAt = Infinity

    const episodes = this.dataManager.raw.exEpisodes.slice(0)
    const badEpisodes: ExEpisode[] = []
    while (true) {
      let flag = false
      while (episodes.length > 0) {
        const episode = episodes.shift()!
        if (![ExEpisodeType.Story, ExEpisodeType.Normal, ExEpisodeType.Boss].includes(episode.type)) continue
        const chapter = this.dataManager.raw.exChapters.find((x) => x.id == episode.chapterId)
        if (!chapter || !chapter.chapterIndex || chapter.type === ExChapterType.Simulate) continue

        const previous = episode.preEpisode ? this.stageInfo[String(episode.preEpisode)] : null
        if (episode.preEpisode && !previous) {
          badEpisodes.push(episode)
          continue
        }

        let number = previous ? previous.number + 1 : 1
        if (previous && previous.chapter != chapter) number = 1
        if (chapter.type === ExChapterType.Hard) {
          if (!previous) throw new Error('hard without previous! ' + episode.id)
          number = previous!.number
        }

        let zoneId = String(chapter.id)
        let zoneName = `${chapter.chapterIndex} ${chapter.name}`
        if (chapter.type === ExChapterType.Hard) {
          zoneId = previous!.zoneId
          zoneName = `${previous!.chapter.chapterIndex} ${previous!.chapter.name}`
        }
        this.zoneNames[zoneId] = zoneName

        const stageInfo = new Re1999StageInfo(this, episode, chapter, number, zoneId)
        this.stageInfo[stageInfo.id] = stageInfo
        flag = true
      }
      if (!badEpisodes.length) break
      if (!flag) {
        throw new Error('cannot resolve preEpisode, pool remaining:' + badEpisodes.map((x) => x.id).join(','))
      }
      episodes.push(...badEpisodes)
      badEpisodes.length = 0
    }

    for (const [key, value] of Object.entries(this.dataManager.raw.drops)) {
      if (key[0] === '$') continue
      const stage = Object.values(this.stageInfo).find((x) => x.dropCode == key)
      if (!stage) {
        throw new Error('cannot find stage from drop ' + key)
      }
      if (stage.ap !== value.cost) throw new Error('ap mismatch from drop ' + key)
      if (value.count < 5) continue
      stage.valid = true
      for (let [itemName, drop] of Object.entries(value.drops)) {
        if (itemName === '秘银原石') {
          itemName = '银矿原石'
        }
        const itemId = this.getInventoryItems().find((x) => x.name == itemName)?.key
        if (!itemId) throw new Error('invalid drop ' + key + ' ' + itemName)

        stage.addDrop(itemId, drop, value.count)
      }
    }

    const findByCode = (code: string) => Object.values(this.stageInfo).find((x) => x.code === code)
    findByCode('LP-1')!.addDrop(RE_ITEM_EXP, 4200).valid = true
    findByCode('LP-2')!.addDrop(RE_ITEM_EXP, 5700).valid = true
    findByCode('LP-3')!.addDrop(RE_ITEM_EXP, 7400).valid = true
    findByCode('LP-4')!.addDrop(RE_ITEM_EXP, 8800).valid = true
    findByCode('LP-5')!.addDrop(RE_ITEM_EXP, 10350).valid = true
    findByCode('LP-6')!.addDrop(RE_ITEM_EXP, 12500).valid = true

    findByCode('MA-1')!.addDrop(RE_ITEM_GOLD, 2600).valid = true
    findByCode('MA-2')!.addDrop(RE_ITEM_GOLD, 3600).valid = true
    findByCode('MA-3')!.addDrop(RE_ITEM_GOLD, 4750).valid = true
    findByCode('MA-4')!.addDrop(RE_ITEM_GOLD, 5800).valid = true
    findByCode('MA-5')!.addDrop(RE_ITEM_GOLD, 7150).valid = true
    findByCode('MA-6')!.addDrop(RE_ITEM_GOLD, 9000).valid = true

    findByCode('ME-1')!.addDrop('115011', 1).valid = true
    findByCode('ME-2')!.addDrop('115011', 2).valid = true
    findByCode('ME-3')!.addDrop('115012', 1).valid = true
    findByCode('ME-4')!.addDrop('115012', 2).valid = true
    findByCode('ME-5')!.addDrop('115013', 1).valid = true
    findByCode('ME-6')!.addDrop('115013', 2).valid = true

    findByCode('SL-1')!.addDrop('115021', 1).valid = true
    findByCode('SL-2')!.addDrop('115021', 2).valid = true
    findByCode('SL-3')!.addDrop('115022', 1).valid = true
    findByCode('SL-4')!.addDrop('115022', 2).valid = true
    findByCode('SL-5')!.addDrop('115023', 1).valid = true
    findByCode('SL-6')!.addDrop('115023', 2).valid = true

    findByCode('SS-1')!.addDrop('115031', 1).valid = true
    findByCode('SS-2')!.addDrop('115031', 2).valid = true
    findByCode('SS-3')!.addDrop('115032', 1).valid = true
    findByCode('SS-4')!.addDrop('115032', 2).valid = true
    findByCode('SS-5')!.addDrop('115033', 1).valid = true
    findByCode('SS-6')!.addDrop('115033', 2).valid = true

    findByCode('BW-1')!.addDrop('115041', 1).valid = true
    findByCode('BW-2')!.addDrop('115041', 2).valid = true
    findByCode('BW-3')!.addDrop('115042', 1).valid = true
    findByCode('BW-4')!.addDrop('115042', 2).valid = true
    findByCode('BW-5')!.addDrop('115043', 1).valid = true
    findByCode('BW-6')!.addDrop('115043', 2).valid = true

    for (const stage of Object.values(this.stageInfo)) {
      if (!stage.episode.battleId) {
        delete this.stageInfo[stage.id]
        continue
      }
      if (!stage.ap) {
        delete this.stageInfo[stage.id]
        continue
      }
      if (!stage.valid) {
        delete this.stageInfo[stage.id]
        continue
      }
    }
    // const loadZoneName = (stageInfo: ExcelStageTable.Stage, isRetro: boolean) => {
    //   if (this.zoneNames[stageInfo.zoneId]) return
    //   if (isRetro) {
    //     const retroId = this.dataManager.raw.exRetro.zoneToRetro[stageInfo.zoneId]
    //     if (retroId) {
    //       this.zoneNames[stageInfo.zoneId] = this.dataManager.raw.exRetro.retroActList[retroId]?.name
    //     }
    //   } else {
    //     const zone = this.dataManager.raw.exZone.zones[stageInfo.zoneId]
    //     this.zoneNames[stageInfo.zoneId] = [zone?.zoneNameFirst || '', zone?.zoneNameSecond || ''].join(' ')
    //   }
    // }
    // const matrixKeys = new Set(this.dataManager.raw.penguinMatrix.matrix.map((x) => x.stageId))
    // for (const stageId of matrixKeys) {
    //   if (stageId.endsWith('_rep')) {
    //     matrixKeys.delete(stageId.slice(0, stageId.length - 4) + '_perm')
    //   }
    // }
    // for (const i of this.dataManager.raw.penguinMatrix.matrix) {
    //   if (!matrixKeys.has(i.stageId)) continue
    //   if (i.start && i.start > now) {
    //     this.cacheExpiresAt = Math.min(this.cacheExpiresAt, i.start)
    //   }
    //   if (i.end && i.end > now) {
    //     this.cacheExpiresAt = Math.min(this.cacheExpiresAt, i.end)
    //   }
    //   if (i.start > now || (i.end && i.end < now)) continue
    //   if (!this.dataManager.data.items[i.itemId]) continue

    //   let stageId = i.stageId
    //   if (stageId.startsWith('wk_armor_')) continue // SK-...

    //   let stageInfo = this.dataManager.raw.exStage.stages[stageId]
    //   let isRetro = false
    //   if (stageId.endsWith('_rep')) {
    //     stageId = stageId.slice(0, stageId.length - 4)
    //     stageInfo = this.dataManager.raw.exStage.stages[stageId]
    //   } else if (stageId.endsWith('_perm')) {
    //     stageId = stageId.slice(0, stageId.length - 5)
    //     stageInfo = this.dataManager.raw.exRetro.stageList[stageId]
    //     isRetro = true
    //   }
    //   if (!stageInfo) {
    //     continue
    //   }
    //   loadZoneName(stageInfo, isRetro)

    //   let stage = map.get(stageId)
    //   if (!stage) {
    //     stage = new Re1999StageInfo(this, stageInfo)
    //     map.set(stageId, stage)
    //     this.stageInfo[stageId] = stage

    //     if (!stageInfo.apCost) console.log(stageInfo)
    //     stage.setAp(stageInfo.apCost)
    //     stage.addDrop(AK_ITEM_GOLD, stageInfo.apCost * 12)
    //   }

    //   stage.addDrop(i.itemId, i.quantity, i.times)
    // }

    // const makeCE = (stageId: string, gold: number) => {
    //   const stageInfo = this.dataManager.raw.exStage.stages[stageId]
    //   const stage = new Re1999StageInfo(this, stageInfo)
    //   stage.setAp(stageInfo.apCost)
    //   stage.addDrop(AK_ITEM_GOLD, gold)
    //   map.set(stageId, stage)
    //   this.stageInfo[stageId] = stage
    //   loadZoneName(stageInfo, false)
    // }
    // makeCE('wk_melee_6', 10000)
    // makeCE('wk_melee_5', 7500)
    // makeCE('wk_melee_4', 5700)
    // makeCE('wk_melee_3', 4100)
    // makeCE('wk_melee_2', 2800)
    // makeCE('wk_melee_1', 1700)

    // const makeAP = (stageId: string, ticket: number) => {
    //   const stageInfo = this.dataManager.raw.exStage.stages[stageId]
    //   const stage = new Re1999StageInfo(this, stageInfo)
    //   stage.setAp(stageInfo.apCost)
    //   stage.addDrop('4006', ticket)
    //   stage.addDrop(AK_ITEM_GOLD, stageInfo.apCost * 12)
    //   map.set(stageId, stage)
    //   this.stageInfo[stageId] = stage
    //   loadZoneName(stageInfo, false)
    // }
    // makeAP('wk_toxic_5', 21)

    return this.stageInfo
  }
}

class Re1999StageInfo extends BasicStageInfo {
  constructor(
    ga: Re1999Adapter,
    public episode: ExEpisode,
    public chapter: ExChapter,
    public number: number,
    public zoneId: string,
  ) {
    super(ga)
    this.code = `${this.chapter.type === ExChapterType.Hard ? '厄险' : ''}${this.chapter.chapterIndex}-${this.number}`
    this.dropCode = ''
    if (this.chapter.chapterIndex.match(/^\d+[A-Z]+$/)) {
      this.dropCode = `${this.chapter.chapterIndex.replace(/[A-Z]/g, '')}-${this.number}${
        this.chapter.type === ExChapterType.Hard ? '厄险' : '普通'
      }`
    }

    const apCost = parseConsume(episode.cost)
    if (apCost.length == 0) {
      this.setAp(0)
    } else if (apCost.length !== 1 || apCost[0].itemId !== '2#4') {
      throw new Error('invalid episode apCost: ' + JSON.stringify(this))
    } else {
      this.setAp(apCost[0].quantity)
    }
  }

  public valid: boolean = false

  get id(): string {
    return String(this.episode.id)
  }

  get name(): string {
    return this.episode.name
  }

  code: string
  dropCode: string
  get sortKey(): string {
    return this.code
  }

  public sortDropInfo(
    di: [itemId: string, drops: number, samples: number][],
  ): [itemId: string, drops: number, samples: number][] {
    return sortBy((i) => {
      if (i[0] === RE_ITEM_EXP) return 1000
      if (i[0] === RE_ITEM_GOLD) return 1001
      return -(this.ga.getItem(i[0]).valueAsAp || 0) * (Number.isFinite(i[2]) ? i[1] / i[2] : i[1])
    }, di)
  }
}

const zoneNameOverrides: Record<string, string> = {
  weekly_chips: '芯片搜索',
}

const zoneReplacement: Record<string, string> = {}

export enum Category {
  Gold = '0',
  Rarity5 = '1',
  Rarity4 = '2',
  Rarity3 = '3',
  Rarity2 = '4',
  Rarity1 = '5',
  Resonate = '7',
  Insight3 = '81',
  Insight2 = '82',
  Insight1 = '83',
  Unknown = '9',
}

export const CategoryNames = {
  [Category.Gold]: '钱和经验',
  [Category.Rarity5]: '彩材料',
  [Category.Rarity4]: '金材料',
  [Category.Rarity3]: '紫材料',
  [Category.Rarity2]: '蓝材料',
  [Category.Rarity1]: '绿材料',
  [Category.Resonate]: '共鸣',
  [Category.Insight3]: '洞悉三',
  [Category.Insight2]: '洞悉二',
  [Category.Insight1]: '洞悉一',
  [Category.Unknown]: '其他',
} satisfies Record<Category, string>

export const myCategories = {
  [RE_ITEM_EXP]: Category.Gold,
  [RE_ITEM_GOLD]: Category.Gold,
} satisfies Record<string, Category>
