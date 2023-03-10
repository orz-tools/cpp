import pProps from 'p-props'
import { ExcelCharacterTable, ExcelSkillTable, ExcelUniEquipTable } from './excelTypes'
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
    ;(<any>globalThis).$dm = this
  }
  public initialized: boolean = false

  async transform() {
    return {
      characters: this.generateCharacters(),
      skills: this.generateSkills(),
      uniEquips: this.generateUniEquips(),
    }
  }
  public data!: Awaited<ReturnType<DataManager['transform']>>

  async loadRaw() {
    return (await pProps({
      exCharacters: DataManager.loadJson<ExcelCharacterTable>(
        'https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/zh_CN/gamedata/excel/character_table.json',
      ),
      exSkills: DataManager.loadJson<ExcelSkillTable>(
        'https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/zh_CN/gamedata/excel/skill_table.json',
      ),
      exUniEquip: DataManager.loadJson<ExcelUniEquipTable>(
        'https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/zh_CN/gamedata/excel/uniequip_table.json',
      ),
    })) as {
      exCharacters: ExcelCharacterTable
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
}

export class Character {
  constructor(
    public readonly key: string,
    public readonly raw: ExcelCharacterTable.Character,
    private readonly dm: DataManager,
  ) {}

  get avatar() {
    return `https://raw.githubusercontent.com/yuanyan3060/Arknights-Bot-Resource/main/avatar/${encodeURIComponent(
      this.key,
    )}.png`
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
