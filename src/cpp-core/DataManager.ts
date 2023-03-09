import pProps from 'p-props'
import { ExcelCharacterTable } from './excelTypes'

const STORAGE_PREFIX = 'cpp_dm_'

export class DataManager {
  async init() {
    await this.loadRaw()
    await this.transform()
  }

  async transform() {
    return {
      characters: this.generateCharacters(),
    }
  }
  public data!: Awaited<ReturnType<DataManager['transform']>>

  async loadRaw() {
    return await pProps({
      exCharacters: DataManager.loadJson<ExcelCharacterTable>(
        'https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/zh_CN/gamedata/excel/character_table.json',
      ),
    })
  }
  public raw!: Awaited<ReturnType<DataManager['loadRaw']>>

  private static async loadJson<T>(url: string, key = url): Promise<T> {
    const fullKey = `${STORAGE_PREFIX}${key}`
    const existing = localStorage.getItem(fullKey) || ''
    if (existing) {
      try {
        return JSON.parse(existing)
      } catch {}
    }
    const result = await (await fetch(url)).json()
    localStorage.setItem(fullKey, JSON.stringify(result))
    return result
  }

  private generateCharacters() {
    return Object.fromEntries(Object.entries(this.raw.exCharacters).map(([key, raw]) => [key, new Character(raw)]))
  }
}

export class Character {
  constructor(public readonly raw: ExcelCharacterTable.Character) {}
}
