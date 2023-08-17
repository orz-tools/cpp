import { CppData_ArknightsKengxxiaoEnUs } from '../cpp-data-schemas/arknights-kengxxiao-en_US'
import { CppData_ArknightsKengxxiaoZhCn } from '../cpp-data-schemas/arknights-kengxxiao-zh_CN'
import { CONTAINER_TYPE, CONTAINER_VERSION, CppRepoObject, DataContainerObject, IDataContainer } from '../dccache'
import { PenguinMatrix } from './sources/penguinTypes'
import { YituliuValue } from './sources/yituliuTypes'

export class ArknightsKengxxiaoObject extends CppRepoObject<
  CppData_ArknightsKengxxiaoZhCn | CppData_ArknightsKengxxiaoEnUs
> {
  public requiredSchema = 2

  public constructor(public readonly lang: 'en_US' | 'zh_CN') {
    super(`arknights-kengxxiao-${lang}`)
  }
}

export class ArknightsYituliuObject extends DataContainerObject<YituliuValue[]> {
  public autoUpdateNotificationThreshold = 86400_000 * 3

  public readonly name: string = 'arknights-yituliu'

  public getData(): Promise<IDataContainer<YituliuValue[]>> {
    return Promise.reject(new Error('ArknightsYituliuObject.getData is useless.'))
  }

  public async getHeader(force?: boolean | undefined): Promise<IDataContainer<YituliuValue[]>> {
    const res = await fetch('https://backend.yituliu.site/item/export/json')
    if (!res.ok) {
      if (force) {
        throw new Error(`Failed to fetch yituliu: ${res.status} ${res.statusText}`)
      }
      const now = new Date(0)
      return {
        '@type': CONTAINER_TYPE,
        '@version': CONTAINER_VERSION,
        name: this.name,
        version: {
          id: now.toJSON(),
          text: '加载失败',
          schema: 0,
          sources: ['https://yituliu.site/'],
          timestamp: now.getTime(),
        },
        data: [] satisfies YituliuValue[],
      }
    }

    const now = new Date()
    return {
      '@type': CONTAINER_TYPE,
      '@version': CONTAINER_VERSION,
      name: this.name,
      version: {
        id: now.toJSON(),
        text: now.toJSON(),
        schema: 0,
        sources: ['https://yituliu.site/'],
        timestamp: now.getTime(),
      },
      data: (await res.json()) as YituliuValue[],
    }
  }
}

export class ArknightsPenguinObject extends DataContainerObject<PenguinMatrix> {
  public autoUpdateNotificationThreshold = 86400_000 * 3

  public constructor(public readonly server: 'CN') {
    super()
    this.name = 'arknights-penguin-' + server
  }

  public readonly name: string

  public getData(): Promise<IDataContainer<PenguinMatrix>> {
    return Promise.reject(new Error('ArknightsPenguinObject.getData is useless.'))
  }

  public async getHeader(): Promise<IDataContainer<PenguinMatrix>> {
    const res = await fetch(
      `https://penguin-stats.cn/PenguinStats/api/v2/result/matrix?${new URLSearchParams({
        server: this.server,
      })}`,
    )
    if (!res.ok) {
      throw new Error(`Failed to fetch penguin: ${res.status} ${res.statusText}`)
    }

    const now = new Date()
    return {
      '@type': CONTAINER_TYPE,
      '@version': CONTAINER_VERSION,
      name: this.name,
      version: {
        id: now.toJSON(),
        text: now.toJSON(),
        schema: 1,
        sources: ['https://penguin-stats.io'],
        timestamp: now.getTime(),
      },
      data: (await res.json()) as PenguinMatrix,
    }
  }
}
