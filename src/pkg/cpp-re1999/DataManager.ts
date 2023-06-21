import { BasicDataManager, Formula, ICharacter, IItem } from '../cpp-basic'
import { Category } from './GameAdapter'
import {
  ExChapter,
  ExCharacter,
  ExCharacterConsume,
  ExCharacterRank,
  ExCharacterTalent,
  ExCurrency,
  ExEpisode,
  ExFormula,
  ExItem,
  Re1999,
} from './types'

export class Re1999DataManager extends BasicDataManager<Re1999> {
  constructor() {
    super('re1999_')
  }

  async transform() {
    return {
      characters: this.generateCharacters(),
      items: this.generateItems(),
      formulas: this.generateFormulas(),
      constants: this.generateConstants(),
    }
  }

  getLoadRawTasks(refresh?: boolean | undefined) {
    return {
      exChapters: this.loadJson<ExChapter[]>(
        'https://raw.githubusercontent.com/yuanyan3060/Reverse1999Resource/main/Json/chapter.json',
        refresh,
      ),
      exEpisodes: this.loadJson<ExEpisode[]>(
        'https://raw.githubusercontent.com/yuanyan3060/Reverse1999Resource/main/Json/episode.json',
        refresh,
      ),
      exCharacters: this.loadJson<ExCharacter[]>(
        'https://raw.githubusercontent.com/yuanyan3060/Reverse1999Resource/main/Json/character.json',
        refresh,
      ),
      exItems: this.loadJson<ExItem[]>(
        'https://raw.githubusercontent.com/yuanyan3060/Reverse1999Resource/main/Json/item.json',
        refresh,
      ),
      exCurrencies: this.loadJson<ExCurrency[]>(
        'https://raw.githubusercontent.com/yuanyan3060/Reverse1999Resource/main/Json/currency.json',
        refresh,
      ),
      exFormulas: this.loadJson<ExFormula[]>(
        'https://raw.githubusercontent.com/yuanyan3060/Reverse1999Resource/main/Json/formula.json',
        refresh,
      ),
      exCharacterRank: this.loadJson<ExCharacterRank[]>(
        'https://raw.githubusercontent.com/yuanyan3060/Reverse1999Resource/main/Json/character_rank.json',
        refresh,
      ),
      exCharacterConsume: this.loadJson<ExCharacterConsume[]>(
        'https://raw.githubusercontent.com/yuanyan3060/Reverse1999Resource/main/Json/character_cosume.json',
        refresh,
      ),
      exCharacterTalent: this.loadJson<ExCharacterTalent[]>(
        'https://raw.githubusercontent.com/yuanyan3060/Reverse1999Resource/main/Json/character_talent.json',
        refresh,
      ),
      drops: (async () =>
        (await import('./data/drops.json')).default as {
          updatedAt: string
          sourceUrl: string
          levelReport: Record<string, { count: number; cost: number; drops: Record<string, number> }>
        })(),
    }
  }

  private generateCharacters() {
    return Object.fromEntries(
      Object.entries(this.raw.exCharacters)
        .filter((x) => x[1].isOnline === '1')
        .map(([key, raw]) => [String(raw.id), new Character(String(raw.id), raw, this)]),
    )
  }

  private generateItems() {
    const items = Object.fromEntries(
      Object.entries(this.raw.exItems).map(([key, raw]) => [`${raw.id}`, new Item(`${raw.id}`, raw, this)]),
    )
    const currencies = Object.fromEntries(
      Object.entries(this.raw.exCurrencies).map(([key, raw]) => [
        `2#${raw.id}`,
        new CurrencyItem(`2#${raw.id}`, raw, this),
      ]),
    )

    return Object.assign({}, items, currencies)
  }

  private generateConstants() {
    const maxLevel = [[], [30, 40, 50], [30, 40, 50], [30, 40, 50], [30, 40, 50, 60], [30, 40, 50, 60]]
    const levelExp: number[][][] = [[], [], [], [], [], []]
    const levelGold: number[][][] = [[], [], [], [], [], []]

    for (const i of this.raw.exCharacterConsume) {
      if (!levelExp[i.rare]) levelExp[i.rare] = []
      if (!levelGold[i.rare]) levelGold[i.rare] = []
      let insight = 0
      let level = i.level
      for (const z of maxLevel[i.rare]) {
        if (level > z) {
          level -= z
          insight++
        } else {
          break
        }
      }
      const consume = (level == 1 ? '2#5#0|2#3#0' : i.cosume).match(/^2#5#(\d+)\|2#3#(\d+)$/)
      if (!consume) throw new Error('failed to parse consume data ' + JSON.stringify(i))
      const exp = parseInt(consume[1], 10)
      const gold = parseInt(consume[2], 10)

      if (!levelExp[i.rare][insight]) levelExp[i.rare][insight] = new Array(maxLevel[i.rare][insight]).fill(0)
      if (!levelGold[i.rare][insight]) levelGold[i.rare][insight] = new Array(maxLevel[i.rare][insight]).fill(0)
      levelExp[i.rare][insight][level - 1] = exp
      levelGold[i.rare][insight][level - 1] = gold
    }

    const result = {
      maxLevel,
      levelExp,
      levelGold,
    }
    return result
  }

  private generateFormulas() {
    const formulas: Formula[] = []
    for (const i of this.raw.exFormulas) {
      if (i.type !== 2) continue
      const produced = parseConsume(i.produce)
      if (produced.length !== 1) throw new Error('invalid produced ' + JSON.stringify(i))
      const formula: Formula = {
        tags: [],
        id: `formula-${i.id}`,
        costs: [...parseConsume(i.costMaterial), ...parseConsume(i.costScore)],
        itemId: produced[0].itemId,
        quantity: produced[0].quantity,
      }
      formulas.push(formula)
    }
    return formulas
  }
}

export interface CharacterLevel {
  insight: number
  level: number
}

export class Character implements ICharacter {
  constructor(public readonly key: string, public readonly raw: ExCharacter, private readonly dm: Re1999DataManager) {}

  get name(): string {
    return this.raw.name
  }

  get appellation(): string {
    return this.raw.nameEng
  }

  get avatar() {
    return `https://raw.githubusercontent.com/yuanyan3060/Reverse1999Resource/main/HeadIconSmall/${this.raw.skinId}.png`
  }

  get rarity() {
    return this.raw.rare
  }

  get maxInsight() {
    return this.maxLevels.length - 1
  }

  get maxLevels() {
    return this.dm.data.constants.maxLevel[this.rarity]
  }

  get characterViewExtraClass() {
    return [`career-${this.raw.career}`, `dmgtype-${this.raw.dmgType}`]
  }

  insightCost(insight: number) {
    const row = this.dm.raw.exCharacterRank.find((x) => x.heroId === this.raw.id && x.rank - 1 === insight)
    if (!row) return []
    return parseConsume(row.consume)
  }

  _resonates?: ExCharacterTalent[]
  get resonates() {
    if (!this._resonates) this._resonates = this.dm.raw.exCharacterTalent.filter((x) => x.heroId === this.raw.id)
    return this._resonates
  }

  _maxResonate?: number
  get maxResonate() {
    if (this._maxResonate === undefined) {
      this._maxResonate = Math.max(...this.resonates.map((x) => x.talentId), 1)
    }
    return this._maxResonate
  }

  resonateInsightRequires(resonate: number) {
    return this.resonates.find((x) => x.talentId == resonate)!.requirement - 1
  }

  resonateCost(resonate: number) {
    return parseConsume(this.resonates.find((x) => x.talentId == resonate)!.consume)
  }

  maxResonateAtInsight(insight: number) {
    return Math.max(...this.resonates.filter((x) => x.requirement - 1 === insight).map((x) => x.talentId), 1)
  }
}

export function parseConsume(consume: string): { itemId: string; quantity: number }[] {
  const result: { itemId: string; quantity: number }[] = []
  if (!consume) return []
  const parts = consume.split('|')
  for (const part of parts) {
    const [type, itemId, quantity] = part.split('#')
    result.push({ itemId: type === '1' ? itemId : `${type}#${itemId}`, quantity: parseInt(quantity, 10) })
  }
  return result
}

function makeNumericSortable(x: string) {
  return x.replace(/\d+/g, (y) => String(y).padStart(20, '0'))
}

export class Item implements IItem {
  constructor(public readonly key: string, public readonly raw: ExItem, protected readonly dm: Re1999DataManager) {}

  get sortId(): string {
    return '3-' + makeNumericSortable(this.raw.id.toFixed(0))
  }

  get name(): string {
    return this.raw.name
  }

  get icon() {
    return `https://raw.githubusercontent.com/yuanyan3060/Reverse1999Resource/main/Item/${this.raw.icon}.png`
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
    return undefined
  }

  get inventoryCategory(): string {
    switch (this.key) {
      case '115011':
      case '115021':
      case '115031':
      case '115041':
        return Category.Insight1
      case '115012':
      case '115022':
      case '115032':
      case '115042':
        return Category.Insight2
      case '115013':
      case '115023':
      case '115033':
      case '115043':
        return Category.Insight3
    }
    if (this.raw.subType == 12) return Category.Resonate
    if (this.raw.rare == 1) return Category.Rarity1
    if (this.raw.rare == 2) return Category.Rarity2
    if (this.raw.rare == 3) return Category.Rarity3
    if (this.raw.rare == 4) return Category.Rarity4
    if (this.raw.rare == 5) return Category.Rarity5
    return Category.Unknown
  }

  isCurrency: false = false
}

export class CurrencyItem implements IItem {
  constructor(public readonly key: string, public readonly raw: ExCurrency, protected readonly dm: Re1999DataManager) {}

  isCurrency: true = true
  get sortId(): string {
    return '1-' + makeNumericSortable(this.raw.id.toFixed(0))
  }

  get name(): string {
    return this.raw.name
  }

  get icon() {
    return ''
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
    return undefined
  }

  get inventoryCategory(): string {
    return Category.Gold
  }
}
