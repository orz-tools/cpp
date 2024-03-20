import { BlobImages, blobImage } from '../blobcache'
import { BasicDataManager, Formula, ICharacter, IItem } from '../cpp-basic'
import { DataContainerObject } from '../dccache'
import {
  Reverse1999EnigmaticNebulaObject,
  Reverse1999HisBoundenDutyDropsObject,
  Reverse1999HisBoundenDutyValuesObject,
  Reverse1999Yuanyan3060Object,
} from './DataObjects'
import { Category } from './GameAdapter'
import { Re1999, Re1999Region, Reverse1999EnigmaticNebula, Reverse1999Yuanyan3060 } from './types'

export class Re1999DataManager extends BasicDataManager<Re1999> {
  public readonly region!: Re1999Region
  public setRegion(region: string) {
    const validRegions = {
      [Re1999Region.China]: () => null,
      [Re1999Region.GlobalEN]: () => new Reverse1999EnigmaticNebulaObject('en'),
      [Re1999Region.GlobalJP]: () => new Reverse1999EnigmaticNebulaObject('jp'),
      [Re1999Region.GlobalKR]: () => new Reverse1999EnigmaticNebulaObject('kr'),
      [Re1999Region.GlobalTW]: () => new Reverse1999EnigmaticNebulaObject('tw'),
      [Re1999Region.GlobalZH]: () => new Reverse1999EnigmaticNebulaObject('zh'),
    } satisfies Record<Re1999Region, () => Reverse1999EnigmaticNebulaObject | null>

    if (!Object.prototype.hasOwnProperty.call(validRegions, region)) {
      throw new Error('Invalid game region: ' + region)
    }

    ;(this as any).region = region as Re1999Region
    this.$local = validRegions[this.region]()
  }

  public async transform() {
    await Promise.resolve()
    return {
      characters: this.generateCharacters(),
      items: this.generateItems(),
      formulas: this.generateFormulas(),
      constants: this.generateConstants(),
    }
  }

  public $yy = new Reverse1999Yuanyan3060Object('zh_CN')
  public $local!: Reverse1999EnigmaticNebulaObject | null
  public $drops = new Reverse1999HisBoundenDutyDropsObject('china')
  public $values = new Reverse1999HisBoundenDutyValuesObject('china')

  public getRequiredDataObjects(): Promise<DataContainerObject<any>[]> {
    return Promise.resolve([this.$yy, this.$drops, this.$values, ...(this.$local ? [this.$local] : [])])
  }

  public loadRaw() {
    const yy = this.get(this.$yy)
    const drops = this.get(this.$drops)
    const values = this.get(this.$values)
    const local = this.$local ? this.get(this.$local) : null

    return Promise.resolve(
      Object.assign({}, yy.data, {
        drops: drops.data,
        values: values.data,
        local: local?.data,
      }),
    )
  }

  private generateCharacters() {
    return Object.fromEntries(
      Object.entries(this.raw.exCharacters)
        .filter((x) => x[1].isOnline === '1')
        .map(([, raw]) => [
          String(raw.id),
          new Character(String(raw.id), raw, this.raw.local?.exCharacters.find((x) => x.id === raw.id) || null, this),
        ]),
    )
  }

  private generateItems() {
    const items = Object.fromEntries(
      Object.entries(this.raw.exItems).map(([, raw]) => [
        `${raw.id}`,
        new Item(`${raw.id}`, raw, this.raw.local?.exItems.find((x) => x.id === raw.id) || null, this),
      ]),
    )
    const currencies = Object.fromEntries(
      Object.entries(this.raw.exCurrencies).map(([, raw]) => [
        `2#${raw.id}`,
        new CurrencyItem(`2#${raw.id}`, raw, this.raw.local?.exCurrencies.find((x) => x.id === raw.id) || null, this),
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
      const consume = (level === 1 ? '2#5#0|2#3#0' : i.cosume).match(/^2#5#(\d+)\|2#3#(\d+)$/)
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
  public constructor(
    public readonly key: string,
    public readonly raw: Reverse1999Yuanyan3060['exCharacters'][0],
    public readonly rawLocal: Reverse1999EnigmaticNebula['exCharacters'][0] | null,
    private readonly dm: Re1999DataManager,
  ) {}

  public get name(): string {
    return this.rawLocal?.name || this.raw.name
  }

  public get appellation(): string {
    const value = this.rawLocal?.nameEng || this.raw.nameEng
    const name = this.name
    if (value === name) return this.raw.name
    return value
  }

  private _avatar?: [BlobImages]
  public get avatar() {
    return (this._avatar || (this._avatar = [this.avatarGenerator]))[0]
  }
  private get avatarGenerator() {
    return {
      normal: blobImage(
        [],
        `https://raw.githubusercontent.com/yuanyan3060/Reverse1999Resource/main/HeadIconSmall/${this.raw.skinId}.png`,
      ),
    }
  }

  public get rarity() {
    return this.raw.rare
  }

  public get maxInsight() {
    return this.maxLevels.length - 1
  }

  public get maxLevels() {
    return this.dm.data.constants.maxLevel[this.rarity]
  }

  public get characterViewExtraClass() {
    return [`career-${this.raw.career}`, `dmgtype-${this.raw.dmgType}`]
  }

  public insightCost(insight: number) {
    const row = this.dm.raw.exCharacterRank.find((x) => x.heroId === this.raw.id && x.rank - 1 === insight)
    if (!row) return []
    return parseConsume(row.consume)
  }

  private _resonates?: Reverse1999Yuanyan3060['exCharacterTalent'][0][]
  public get resonates() {
    if (!this._resonates) this._resonates = this.dm.raw.exCharacterTalent.filter((x) => x.heroId === this.raw.id)
    return this._resonates
  }

  private _maxResonate?: number
  public get maxResonate() {
    if (this._maxResonate === undefined) {
      this._maxResonate = Math.max(...this.resonates.map((x) => x.talentId), 1)
    }
    return this._maxResonate
  }

  public resonateInsightRequires(resonate: number) {
    return this.resonates.find((x) => x.talentId === resonate)!.requirement - 1
  }

  public resonateCost(resonate: number) {
    return parseConsume(this.resonates.find((x) => x.talentId === resonate)!.consume)
  }

  public maxResonateAtInsight(insight: number) {
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
  public constructor(
    public readonly key: string,
    public readonly raw: Reverse1999Yuanyan3060['exItems'][0],
    public readonly rawLocal: Reverse1999EnigmaticNebula['exItems'][0] | null,
    protected readonly dm: Re1999DataManager,
  ) {}

  public get sortId(): string {
    return '3-' + makeNumericSortable(this.raw.id.toFixed(0))
  }

  public get name(): string {
    return this.rawLocal?.name || this.raw.name
  }

  private _icon?: [BlobImages]
  public get icon() {
    return (this._icon || (this._icon = [this.iconGenerator]))[0]
  }
  private get iconGenerator() {
    return {
      normal: blobImage(
        [],
        `https://raw.githubusercontent.com/yuanyan3060/Reverse1999Resource/main/Item/${this.raw.icon}.png`,
      ),
      soul: blobImage([
        `https://raw.githubusercontent.com/orz-tools/cpp-soul/master/reverse1999/items/${this.raw.icon}.png`,
      ]),
    }
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
      case '115011':
      case '115021':
      case '115031':
      case '115041':
        return 18 / 2
      case '115012':
      case '115022':
      case '115032':
      case '115042':
        return 24 / 2
      case '115013':
      case '115023':
      case '115033':
      case '115043':
        return 30 / 2
    }
    const m = this.dm.raw.values.values
    const k = this.raw.id.toFixed(0)
    if (!Object.hasOwnProperty.call(m, k)) return undefined
    return parseFloat(m[k])
  }

  public get inventoryCategory(): string {
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
    if (this.raw.subType === 12) return Category.Resonate
    if (this.raw.subType === 18) return Category.Equip
    if (this.raw.subType === 19) return Category.Room
    if (this.raw.rare === 1) return Category.Rarity1
    if (this.raw.rare === 2) return Category.Rarity2
    if (this.raw.rare === 3) return Category.Rarity3
    if (this.raw.rare === 4) return Category.Rarity4
    if (this.raw.rare === 5) return Category.Rarity5
    return Category.Unknown
  }

  public isCurrency = false as const
}

export class CurrencyItem implements IItem {
  public constructor(
    public readonly key: string,
    public readonly raw: Reverse1999Yuanyan3060['exCurrencies'][0],
    public readonly rawLocal: Reverse1999EnigmaticNebula['exCurrencies'][0] | null,
    protected readonly dm: Re1999DataManager,
  ) {}

  public isCurrency = true as const
  public get sortId(): string {
    return '1-' + makeNumericSortable(this.raw.id.toFixed(0))
  }

  public get name(): string {
    return this.rawLocal?.name || this.raw.name
  }

  private _icon?: [BlobImages]
  public get icon() {
    return (this._icon || (this._icon = [this.iconGenerator]))[0]
  }
  private get iconGenerator() {
    return {
      normal: blobImage(
        [],
        `https://raw.githubusercontent.com/yuanyan3060/Reverse1999Resource/main/CurrencyItem/${this.raw.icon}.png`,
      ),
      soul: blobImage([
        `https://raw.githubusercontent.com/orz-tools/cpp-soul/master/reverse1999/items/3-${this.raw.icon}.png`,
      ]),
    }
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
      case '2#5':
        return 2700 / 1350000
      case '2#3':
        return 3150 / 1134000
    }
    return undefined
  }

  public get inventoryCategory(): string {
    return Category.Gold
  }
}
