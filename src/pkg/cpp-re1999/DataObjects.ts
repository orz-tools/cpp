import { CppData_Reverse1999EnigmaticnebulaEn } from '../cpp-data-schemas/reverse1999-enigmaticnebula-en'
import { CppData_Reverse1999EnigmaticnebulaJp } from '../cpp-data-schemas/reverse1999-enigmaticnebula-jp'
import { CppData_Reverse1999EnigmaticnebulaKr } from '../cpp-data-schemas/reverse1999-enigmaticnebula-kr'
import { CppData_Reverse1999EnigmaticnebulaTw } from '../cpp-data-schemas/reverse1999-enigmaticnebula-tw'
import { CppData_Reverse1999EnigmaticnebulaZh } from '../cpp-data-schemas/reverse1999-enigmaticnebula-zh'
import { CppData_Reverse1999HisboundendutyDropsChina } from '../cpp-data-schemas/reverse1999-hisboundenduty-drops-china'
import { CppData_Reverse1999HisboundendutyDropsHaiwai } from '../cpp-data-schemas/reverse1999-hisboundenduty-drops-haiwai'
import { CppData_Reverse1999HisboundendutyValuesChina } from '../cpp-data-schemas/reverse1999-hisboundenduty-values-china'
import { CppData_Reverse1999Yuanyan3060ZhCn } from '../cpp-data-schemas/reverse1999-yuanyan3060-zh_CN'
import { CppRepoObject } from '../dccache'

export class Reverse1999Yuanyan3060Object extends CppRepoObject<CppData_Reverse1999Yuanyan3060ZhCn> {
  public requiredSchema = 2

  public constructor(public readonly lang: 'zh_CN') {
    super(`reverse1999-yuanyan3060-${lang}`)
  }
}

export class Reverse1999EnigmaticNebulaObject extends CppRepoObject<
  | CppData_Reverse1999EnigmaticnebulaEn
  | CppData_Reverse1999EnigmaticnebulaJp
  | CppData_Reverse1999EnigmaticnebulaKr
  | CppData_Reverse1999EnigmaticnebulaTw
  | CppData_Reverse1999EnigmaticnebulaZh
> {
  public requiredSchema = 2

  public constructor(public readonly lang: 'en' | 'jp' | 'kr' | 'tw' | 'zh') {
    super(`reverse1999-enigmaticnebula-${lang}`)
  }
}

export class Reverse1999HisBoundenDutyDropsObject extends CppRepoObject<
  CppData_Reverse1999HisboundendutyDropsChina | CppData_Reverse1999HisboundendutyDropsHaiwai
> {
  public requiredSchema = 1
  public autoUpdateNotificationThreshold = 86400_000 * 3
  public autoUpdateThreshold = 0

  public constructor(public readonly region: 'china' | 'haiwai') {
    super(`reverse1999-hisboundenduty-drops-${region}`)
  }
}

export class Reverse1999HisBoundenDutyValuesObject extends CppRepoObject<CppData_Reverse1999HisboundendutyValuesChina> {
  public requiredSchema = 1
  public autoUpdateNotificationThreshold = 86400_000 * 3
  public autoUpdateThreshold = 0

  public constructor(public readonly region: 'china') {
    super(`reverse1999-hisboundenduty-values-${region}`)
  }
}
