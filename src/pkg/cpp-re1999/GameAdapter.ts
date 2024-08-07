import { sortBy } from 'ramda'
import { GameName } from '../../games'
import {
  BasicStageInfo,
  ExpItem,
  IGameAdapter,
  IGameAdapterStatic,
  PredefinedQuery,
  QNumber,
  QString,
  QueryParam,
  RootCharacterQuery,
} from '../cpp-basic'
import { gt, lpstr } from '../gt'
import { Character, CurrencyItem, Item, Re1999DataManager, parseConsume } from './DataManager'
import { Re1999UserDataAdapter } from './UserDataAdapter'
import {
  ExChapterType,
  ExEpisodeType,
  RE_ITEM_EXP,
  RE_ITEM_GOLD,
  Re1999,
  Re1999Region,
  Reverse1999Yuanyan3060,
  formulaTagNames,
} from './types'

export class Re1999Adapter implements IGameAdapter<Re1999> {
  public readonly dataManager: Re1999DataManager = new Re1999DataManager()
  public readonly userDataAdapter: Re1999UserDataAdapter = new Re1999UserDataAdapter(this.dataManager)

  public static codename: string = GameName.Re1999
  public getCodename(): string {
    return Re1999Adapter.codename
  }

  public static getRegions() {
    return [
      { id: Re1999Region.China, name: 'China (Simplified Chinese)', short: 'CN' },
      { id: Re1999Region.GlobalEN, name: 'Global (English)', short: 'HW-EN' },
      { id: Re1999Region.GlobalJP, name: 'Global (Japanese)', short: 'HW-JP' },
      { id: Re1999Region.GlobalKR, name: 'Global (Korean)', short: 'HW-KR' },
      { id: Re1999Region.GlobalTW, name: 'Global (Traditional Chinese)', short: 'HW-TW' },
      { id: Re1999Region.GlobalZH, name: 'Global (Simplified Chinese)', short: 'HW-ZH' },
    ]
  }

  public readPreference() {
    return undefined as never
  }

  public writePreference(key: string, value: any, storage: Record<string, any>): Record<string, any> {
    return storage
  }

  public getDataManager() {
    return this.dataManager
  }

  public getUserDataAdapter() {
    return this.userDataAdapter
  }

  private rootCharacterQuery = new RootCharacterQuery<Re1999, Character>().tap((aa) => {
    aa.addField('name', '代号', QString, ({ character }) => character.name)
    aa.addField('code', '西文代号', QString, ({ character }) => character.appellation)
      .addAlias('appellation')
      .addAlias('en')
    aa.addField('rarity', '稀有度', QNumber, ({ character }) => character.rarity + 1).addAlias('star')
    aa.addField('career', '属性', QNumber, ({ character }) => character.raw.career)
    aa.addField('dmgtype', '伤害类型', QNumber, ({ character }) => character.raw.dmgType)

    aa.addStatusField('insight', '洞悉', QNumber, ({ status }) => status.insight)
    aa.addStatusField('level', '等级', QNumber, ({ status }) => status.level)
    aa.addStatusField('ilv', '洞悉*100+等级', QNumber, ({ status }) => status.insight * 100 + status.level)
    aa.addStatusField('resonate', '共鸣', QNumber, ({ status }) => status.resonate)
    aa.addStatusField('reasoning', '觉察', QNumber, ({ status }) => status.resonate)
  })

  public getRootCharacterQuery() {
    return this.rootCharacterQuery
  }

  public getDefaultCharacterQueryOrder(): QueryParam['order'] {
    return [
      ['rarity', 'DESC'],
      ['insight', 'DESC'],
      ['level', 'DESC'],
      ['resonate', 'DESC'],
    ]
  }

  public getFavCharacterQueryWhere(): QueryParam['where'] {
    return {
      _: 'field',
      op: '<',
      field: 'insight',
      operand: 3,
    }
  }

  public getPredefinedQueries(): Record<string, PredefinedQuery> {
    return {}
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

  public getInventoryPages() {
    return {
      material: gt.pgettext('re1999 inventory page', '素材'),
    }
  }

  public getInventoryItems(page?: string) {
    return Object.values(this.dataManager.data.items)
      .map((x) => x as Item | CurrencyItem)
      .filter((x) => {
        if ([RE_ITEM_EXP, RE_ITEM_GOLD].includes(x.key)) return true
        if (x.isCurrency) return false
        if (!x.raw.isShow) return false
        if (![11, 12].includes(x.raw.subType)) return false
        // 18 for Equip
        // 19 for Room
        return true
      })
      .sort((a, b) => {
        if (a.isCurrency === false && b.isCurrency === false) {
          if (a.raw.subType < b.raw.subType) return -1
          if (a.raw.subType > b.raw.subType) return 1
          if (a.raw.rare < b.raw.rare) return 1
          if (a.raw.rare > b.raw.rare) return -1
        }
        if (a.sortId < b.sortId) return 1
        if (a.sortId > b.sortId) return -1
        return 0
      })
      .filter((x) => {
        if (!page) return true
        return ![RE_ITEM_EXP, RE_ITEM_GOLD].includes(x.key)
      })
  }

  public getCharacter(key: string) {
    return this.dataManager.data.characters[key]
  }

  public getFormulas() {
    return this.dataManager.data.formulas
  }

  public getExpItems(): Record<string, ExpItem> {
    return {}
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
  private stageInfo: Record<string, Re1999StageInfo> = undefined as any
  private cacheExpiresAt = Infinity

  public getZoneNames() {
    this.getStageInfos()
    return this.zoneNames
  }

  public getStageInfos() {
    if (this.stageInfo && Date.now() < this.cacheExpiresAt) return this.stageInfo

    this.stageInfo = {}
    this.zoneNames = {}
    this.cacheExpiresAt = Infinity

    const allEpisodes = this.dataManager.raw.local?.exEpisodes || this.dataManager.raw.exEpisodes
    const allChapters = this.dataManager.raw.local?.exChapters || this.dataManager.raw.exChapters
    const episodes = allEpisodes.slice(0)
    const badEpisodes: Reverse1999Yuanyan3060['exEpisodes'][0][] = []
    for (;;) {
      let flag = false
      while (episodes.length > 0) {
        const episode = episodes.shift()!
        const chapter = allChapters.find((x) => x.id === episode.chapterId)
        if (!chapter) continue

        let previous = episode.preEpisode ? this.stageInfo[String(episode.preEpisode)] : null
        if (episode.preEpisode && !previous) {
          badEpisodes.push(episode)
          continue
        }
        if (previous && previous.chapter.type === (ExChapterType.Simple as number)) {
          previous = this.stageInfo[String(episode.id - 1)]
        }

        let number = previous ? previous.number + 1 : 1
        if (previous && previous.chapter !== chapter) number = 1
        if (chapter.type === (ExChapterType.Hard as number)) {
          if (!previous) throw new Error(`hard without previous! ${episode.id}`)
          number = previous.number
        }

        let zoneId = String(chapter.id)
        let zoneName = `${chapter.chapterIndex} ${chapter.name}`
        if (chapter.type === (ExChapterType.Hard as number)) {
          zoneId = previous!.zoneId
          zoneName = `${previous!.chapter.chapterIndex} ${previous!.chapter.name}`
        }
        this.zoneNames[zoneId] = zoneName

        const stageInfo = new Re1999StageInfo(this, episode, chapter, number, zoneId)
        if (stageInfo.ap < 0) {
          continue
        }
        this.stageInfo[stageInfo.id] = stageInfo
        flag = true
      }
      if (!badEpisodes.length) break
      if (!flag) {
        console.warn('cannot resolve preEpisode, pool remaining:', badEpisodes)
        break
      }
      episodes.push(...badEpisodes)
      badEpisodes.length = 0
    }

    for (const stage of Object.values(this.stageInfo)) {
      if (![ExChapterType.Simple].includes(stage.chapter.type)) {
        if ([ExEpisodeType.Story, ExEpisodeType.Normal, ExEpisodeType.Boss].includes(stage.episode.type)) {
          continue
        }
        if (stage.chapter.chapterIndex && stage.chapter.type !== (ExChapterType.Simulate as number)) {
          continue
        }
      }
      delete this.stageInfo[stage.id]
      continue
    }

    for (const [key, value] of this.rewriteLevels()) {
      const stage = Object.values(this.stageInfo).find((x) => x.dropCode === key)
      if (!stage) {
        if (this.dataManager.region === Re1999Region.China) {
          throw new Error('cannot find stage from drop ' + key)
        } else {
          continue
        }
      }
      if (stage.ap !== value.cost) throw new Error('ap mismatch from drop ' + key)
      if (value.count < 10) continue
      stage.valid = true
      for (const [inputItemName, drop] of Object.entries(value.drops)) {
        let itemName = inputItemName
        if (itemName === '秘银原石') {
          itemName = '银矿原石'
        }
        let itemId = this.getInventoryItems().find((x) => x.name === itemName)?.key
        if (!itemId) {
          itemId = this.getInventoryItems().find((x) => x.raw.id.toFixed(0) === itemName)?.key
          if (!itemId) {
            throw new Error('invalid drop ' + key + ' ' + itemName)
          }
        }

        if (drop <= 0) continue
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

    return this.stageInfo
  }

  private rewriteLevels() {
    const raw = Object.entries(this.dataManager.raw.drops.levelReport)
    const result: typeof raw = []
    const map = new Map<string, typeof raw>()
    for (const row of raw) {
      let key = row[0]
      if (key.includes('(')) {
        key = key.split('(')[0]
      }
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(row)
    }
    for (const row of map.values()) {
      const x = row
        .map((x) => {
          const verMatch = x[0].match(/\)Ver(\d+)\.(\d+)$/)
          let ver = 0
          if (verMatch) ver = Number(verMatch[1]) * 1000 + Number(verMatch[2])
          return [x, ver] as const
        })
        .sort((a, b) => b[1] - a[1])
      const latest = x[0][0]
      result.push([latest[0].split('(')[0], latest[1]])
    }
    return result
  }
}

const hardCode = lpstr(() => gt.pgettext('re1999 level code', '厄险%s'))
const normalCode = '%s'

class Re1999StageInfo extends BasicStageInfo {
  public constructor(
    ga: Re1999Adapter,
    public episode: Reverse1999Yuanyan3060['exEpisodes'][0],
    public chapter: Reverse1999Yuanyan3060['exChapters'][0],
    public number: number,
    public zoneId: string,
  ) {
    super(ga)
    this.code = (this.chapter.type === (ExChapterType.Hard as number) ? hardCode : normalCode)
      .toString()
      .replaceAll('%s', `${this.chapter.chapterIndex}-${this.number}`)
    this.dropCode = ''
    if (this.chapter.chapterIndex.match(/^\d+[A-Z]+$/)) {
      this.dropCode = `${this.chapter.chapterIndex.replace(/[A-Z]/g, '')}-${this.number}${
        this.chapter.type === (ExChapterType.Hard as number) ? '厄险' : '普通'
      }`
    }

    const apCost = parseConsume(episode.cost)
    if (apCost.length === 0) {
      this.setAp(0)
    } else if (apCost.length !== 1 || apCost[0].itemId !== '2#4') {
      this.setAp(-1)
      console.warn('invalid episode apCost', this.episode)
    } else {
      this.setAp(apCost[0].quantity)
    }
  }

  public valid = false

  public get id(): string {
    return String(this.episode.id)
  }

  public get name(): string {
    return this.episode.name
  }

  public code: string
  public dropCode: string
  public get sortKey(): string {
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

;(function (t: IGameAdapterStatic) {
  return t
})(Re1999Adapter)

export enum Category {
  Gold = '0',
  Rarity5 = '11',
  Rarity4 = '12',
  Rarity3 = '13',
  Rarity2 = '14',
  Rarity1 = '15',
  Insight3 = '31',
  Insight2 = '32',
  Insight1 = '33',
  Resonate = '4',
  Equip = '5',
  Room = '6',
  Unknown = '9',
}

export const CategoryNames = {
  [Category.Gold]: gt.pgettext('re1999 item category', '钱和经验'),
  [Category.Rarity5]: gt.pgettext('re1999 item category', '彩材料'),
  [Category.Rarity4]: gt.pgettext('re1999 item category', '金材料'),
  [Category.Rarity3]: gt.pgettext('re1999 item category', '紫材料'),
  [Category.Rarity2]: gt.pgettext('re1999 item category', '蓝材料'),
  [Category.Rarity1]: gt.pgettext('re1999 item category', '绿材料'),
  [Category.Insight3]: gt.pgettext('re1999 item category', '洞悉三'),
  [Category.Insight2]: gt.pgettext('re1999 item category', '洞悉二'),
  [Category.Insight1]: gt.pgettext('re1999 item category', '洞悉一'),
  [Category.Resonate]: gt.pgettext('re1999 item category', '共鸣&觉察'),
  [Category.Equip]: gt.pgettext('re1999 item category', '心相'),
  [Category.Room]: gt.pgettext('re1999 item category', '荒原'),
  [Category.Unknown]: gt.pgettext('re1999 item category', '其他'),
} satisfies Record<Category, string>

export const myCategories = {
  [RE_ITEM_EXP]: Category.Gold,
  [RE_ITEM_GOLD]: Category.Gold,
} satisfies Record<string, Category>
