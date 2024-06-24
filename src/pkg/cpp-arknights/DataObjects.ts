import { CppData_ArknightsHeyboxOperatorsurvey } from '../cpp-data-schemas/arknights-heybox-operatorsurvey'
import { CppData_ArknightsKengxxiaoEnUs } from '../cpp-data-schemas/arknights-kengxxiao-en_US'
import { CppData_ArknightsKengxxiaoJaJp } from '../cpp-data-schemas/arknights-kengxxiao-ja_JP'
import { CppData_ArknightsKengxxiaoKoKr } from '../cpp-data-schemas/arknights-kengxxiao-ko_KR'
import { CppData_ArknightsKengxxiaoZhCn } from '../cpp-data-schemas/arknights-kengxxiao-zh_CN'
import { CppData_ArknightsYituliuOperatorsurvey } from '../cpp-data-schemas/arknights-yituliu-operatorsurvey'
import { CppData_ArknightsYituliuValues } from '../cpp-data-schemas/arknights-yituliu-values'
import { CONTAINER_TYPE, CONTAINER_VERSION, CppRepoObject, DataContainerObject, IDataContainer } from '../dccache'
import { PenguinMatrix } from './sources/penguinTypes'

export class ArknightsKengxxiaoObject extends CppRepoObject<
  | CppData_ArknightsKengxxiaoZhCn
  | CppData_ArknightsKengxxiaoEnUs
  | CppData_ArknightsKengxxiaoJaJp
  | CppData_ArknightsKengxxiaoKoKr
> {
  public requiredSchema = 3

  public constructor(public readonly lang: 'en_US' | 'zh_CN' | 'ja_JP' | 'ko_KR') {
    super(`arknights-kengxxiao-${lang}`)
  }
}

export class ArknightsYituliuValuesObject extends CppRepoObject<CppData_ArknightsYituliuValues> {
  public requiredSchema = 1
  public autoUpdateNotificationThreshold = 86400_000 * 3
  public autoUpdateThreshold = 0

  public constructor() {
    super(`arknights-yituliu-values`)
  }
}

export class ArknightsYituliuOperatorSurveyObject extends CppRepoObject<CppData_ArknightsYituliuOperatorsurvey> {
  public requiredSchema = 1
  public autoUpdateNotificationThreshold = 86400_000 * 3
  public autoUpdateThreshold = 0

  public constructor() {
    super(`arknights-yituliu-operatorsurvey`)
  }
}

export class ArknightsHeyboxOperatorSurveyObject extends CppRepoObject<CppData_ArknightsHeyboxOperatorsurvey> {
  public requiredSchema = 1
  public autoUpdateNotificationThreshold = 86400_000 * 3
  public autoUpdateThreshold = 0

  public constructor() {
    super(`arknights-heybox-operatorsurvey`)
  }
}

export class ArknightsPenguinObject extends DataContainerObject<PenguinMatrix> {
  public autoUpdateNotificationThreshold = 86400_000 * 3

  public constructor(public readonly server: 'CN' | 'US' | 'JP' | 'KR') {
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
