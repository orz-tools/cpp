import { CppData_Reverse1999HisboundendutyDropsChina } from '../cpp-data-schemas/reverse1999-hisboundenduty-drops-china'
import { CppData_Reverse1999HisboundendutyValuesChina } from '../cpp-data-schemas/reverse1999-hisboundenduty-values-china'
import { CppData_Reverse1999Yuanyan3060ZhCn } from '../cpp-data-schemas/reverse1999-yuanyan3060-zh_CN'
import { CppRepoObject } from '../dccache'

export class Reverse1999Yuanyan3060Object extends CppRepoObject<CppData_Reverse1999Yuanyan3060ZhCn> {
  public requiredSchema = 1

  public constructor(public readonly lang: 'zh_CN') {
    super(`reverse1999-yuanyan3060-${lang}`)
  }
}

export class Reverse1999HisBoundenDutyDropsObject extends CppRepoObject<CppData_Reverse1999HisboundendutyDropsChina> {
  public requiredSchema = 1

  public constructor(public readonly region: 'china') {
    super(`reverse1999-hisboundenduty-drops-${region}`)
  }
}

export class Reverse1999HisBoundenDutyValuesObject extends CppRepoObject<CppData_Reverse1999HisboundendutyValuesChina> {
  public requiredSchema = 1

  public constructor(public readonly region: 'china') {
    super(`reverse1999-hisboundenduty-values-${region}`)
  }
}
