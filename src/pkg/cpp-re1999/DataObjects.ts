import { CppData_Reverse1999Yuanyan3060ZhCn } from '../cpp-data-schemas/reverse1999-yuanyan3060-zh_CN'
import { CONTAINER_TYPE, CONTAINER_VERSION, CppRepoObject, DataContainerObject, IDataContainer } from '../dccache'

export class Reverse1999Yuanyan3060Object extends CppRepoObject<CppData_Reverse1999Yuanyan3060ZhCn> {
  public requiredSchema = 1

  public constructor(public readonly lang: 'zh_CN') {
    super(`reverse1999-yuanyan3060-${lang}`)
  }
}

interface Reverse1999HisBoundenDutyDrops {
  updatedAt: string
  sourceUrl: string
  levelReport: Record<string, { count: number; cost: number; drops: Record<string, number> }>
}

interface Reverse1999HisBoundenDutyValues {
  updatedAt: string
  values: Record<string, string>
}

export class Reverse1999HisBoundenDutyDropsObject extends DataContainerObject<Reverse1999HisBoundenDutyDrops> {
  public readonly name: string = 'reverse1999-hisboundenduty-drops'
  public autoUpdateNotificationThreshold = 86400_000 * 3
  public autoUpdateThreshold = 0

  public getData(): Promise<IDataContainer<Reverse1999HisBoundenDutyDrops>> {
    return Promise.reject(new Error('Reverse1999HisBoundenDutyDropsObject.getData is useless.'))
  }

  public async getHeader(): Promise<IDataContainer<Reverse1999HisBoundenDutyDrops>> {
    const data = (await import('./data/drops.json')).default as Reverse1999HisBoundenDutyDrops

    const now = new Date(data.updatedAt)
    return {
      '@type': CONTAINER_TYPE,
      '@version': CONTAINER_VERSION,
      name: this.name,
      version: {
        id: now.toJSON(),
        text: now.toJSON(),
        schema: 0,
        sources: ['https://bbs.nga.cn/read.php?tid=36522605'],
        timestamp: now.getTime(),
      },
      data: data,
    }
  }
}

export class Reverse1999HisBoundenDutyValuesObject extends DataContainerObject<Reverse1999HisBoundenDutyValues> {
  public readonly name: string = 'reverse1999-hisboundenduty-values'
  public autoUpdateNotificationThreshold = 86400_000 * 3
  public autoUpdateThreshold = 0

  public getData(): Promise<IDataContainer<Reverse1999HisBoundenDutyValues>> {
    return Promise.reject(new Error('Reverse1999HisBoundenDutyValuesObject.getData is useless.'))
  }

  public async getHeader(): Promise<IDataContainer<Reverse1999HisBoundenDutyValues>> {
    const data = (await import('./data/values.json')).default as Reverse1999HisBoundenDutyValues

    const now = new Date(data.updatedAt)
    return {
      '@type': CONTAINER_TYPE,
      '@version': CONTAINER_VERSION,
      name: this.name,
      version: {
        id: now.toJSON(),
        text: now.toJSON(),
        schema: 0,
        sources: ['https://bbs.nga.cn/read.php?tid=36522605'],
        timestamp: now.getTime(),
      },
      data: data,
    }
  }
}
