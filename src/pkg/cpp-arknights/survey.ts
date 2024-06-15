import { gt, lpstr } from '../gt'
import { ArknightsDataManager, Character, Skill, UniEquip } from './DataManager'

export type SurveyProps = { percent: number; samples: number; desc: string }

export interface SurveySource {
  own(character: Character): SurveyProps | null | undefined
  elite0(character: Character): SurveyProps | null | undefined
  elite1(character: Character): SurveyProps | null | undefined
  elite2(character: Character): SurveyProps | null | undefined
  skill(
    character: Character,
    skill: Skill,
    realCharId: string,
    charSkillIndex: number,
  ): (SurveyProps | null | undefined)[] | null | undefined
  mod(character: Character, equip: UniEquip): (SurveyProps | null | undefined)[] | null | undefined
  e2level(character: Character, range: 1 | 70 | 90): SurveyProps | null | undefined
}

export class YituliuSurveySource implements SurveySource {
  public static URL = 'https://ark.yituliu.cn/survey/operators'
  public static Name = lpstr(() => gt.gettext('明日方舟一图流 干员练度统计数据'))
  public static ShortName = lpstr(() => gt.pgettext('short name', '一图流练度统计'))

  public constructor(public readonly dm: ArknightsDataManager) {}

  private get smap() {
    return this.dm.data.yituliuSurvey
  }

  private get scount() {
    return this.dm.raw.yituliuSurvey.userCount
  }

  public own(character: Character): SurveyProps | null | undefined {
    const survey = this.smap[character.key]
    if (!survey) {
      return null
    }

    return {
      percent: survey.own,
      samples: this.scount,
      desc: '干员持有数/总样本数',
    }
  }

  public elite0(character: Character): SurveyProps | null | undefined {
    const survey = this.smap[character.key]
    if (!survey) {
      return null
    }

    return {
      percent: survey.elite.rank0,
      samples: this.scount * survey.own,
      desc: '精零人数/持有人数',
    }
  }

  public elite1(character: Character): SurveyProps | null | undefined {
    const survey = this.smap[character.key]
    if (!survey) {
      return null
    }

    return {
      percent: survey.elite.rank1,
      samples: this.scount * survey.own,
      desc: '精一人数/持有人数',
    }
  }

  public elite2(character: Character): SurveyProps | null | undefined {
    const survey = this.smap[character.key]
    if (!survey) {
      return null
    }

    return {
      percent: survey.elite.rank2,
      samples: this.scount * survey.own,
      desc: '精二人数/持有人数',
    }
  }

  public skill(
    character: Character,
    skill: Skill,
    realCharId: string,
    charSkillIndex: number,
  ): SurveyProps[] | null | undefined {
    const survey = this.smap[realCharId]
    if (!survey) {
      return null
    }

    const skillsSurveys = survey ? [survey.skill1, survey.skill2, survey.skill3] : null
    if (!skillsSurveys) {
      return null
    }

    const ss = skillsSurveys[charSkillIndex]
    if (!ss) {
      return null
    }

    return [
      {
        desc: '专精了此技能的人数（一级及以上）/精二人数',
        percent: ss.count / survey.elite.rank2,
        samples: this.scount * survey.own * survey.elite.rank2,
      },
      {
        desc: '专精一级此技能的人数/专精了此技能的人数（一级及以上）',
        percent: ss.rank1 / ss.count,
        samples: this.scount * survey.own * ss.count,
      },
      {
        desc: '专精二级此技能的人数/专精了此技能的人数（一级及以上）',
        percent: ss.rank2 / ss.count,
        samples: this.scount * survey.own * ss.count,
      },
      {
        desc: '专精三级此技能的人数/专精了此技能的人数（一级及以上）',
        percent: ss.rank3 / ss.count,
        samples: this.scount * survey.own * ss.count,
      },
    ]
  }

  public mod(character: Character, equip: UniEquip): SurveyProps[] | null | undefined {
    const survey = this.smap[equip.raw.charId]
    if (!survey) {
      return null
    }

    const modSurveys = survey
      ? ({
          X: survey.modX,
          Y: survey.modY,
          D: survey.modD,
        } as Record<string, ArknightsDataManager['raw']['yituliuSurvey']['result'][0]['modX']>)
      : null
    if (!modSurveys) {
      return null
    }

    const ss = modSurveys?.[equip.raw.typeName2!]
    if (!ss) {
      return null
    }

    return [
      {
        desc: '解锁了此模组的人数（一级及以上）/精二人数',
        percent: ss.count / survey.elite.rank2,
        samples: this.scount * survey.own * survey.elite.rank2,
      },
      {
        desc: '解锁了此模组一级的人数/解锁了此模组的人数（一级及以上）',
        percent: ss.rank1 / ss.count,
        samples: this.scount * survey.own * ss.count,
      },
      {
        desc: '解锁了此模组二级的人数/解锁了此模组的人数（一级及以上）',
        percent: ss.rank2 / ss.count,
        samples: this.scount * survey.own * ss.count,
      },
      {
        desc: '解锁了此模组三级的人数/解锁了此模组的人数（一级及以上）',
        percent: ss.rank3 / ss.count,
        samples: this.scount * survey.own * ss.count,
      },
    ]
  }

  public e2level(): SurveyProps | null | undefined {
    return undefined
  }
}

export class HeyboxSurveySource implements SurveySource {
  public static URL = 'https://xiaoheihe.cn'
  public static Name = lpstr(() => gt.gettext('小黑盒 app 干员统计数据'))
  public static ShortName = lpstr(() => gt.pgettext('short name', '小黑盒干员统计'))

  public constructor(public readonly dm: ArknightsDataManager) {}

  private get smap() {
    return this.dm.data.heyboxSurvey
  }

  public own(character: Character): SurveyProps | null | undefined {
    const survey = this.smap[character.key]
    if (!survey) {
      return null
    }

    return survey.o == null
      ? null
      : {
          percent: survey.o,
          samples: NaN,
          desc: '持有率：干员持有数/总样本数',
        }
  }

  public elite0(character: Character): SurveyProps | null | undefined {
    const survey = this.smap[character.key]
    if (!survey) {
      return null
    }

    return survey.e[0] == null
      ? null
      : {
          percent: survey.e[0],
          samples: NaN,
          desc: '精英率[0]：精零人数/持有人数',
        }
  }

  public elite1(character: Character): SurveyProps | null | undefined {
    const survey = this.smap[character.key]
    if (!survey) {
      return null
    }

    return survey.e[1] == null
      ? null
      : {
          percent: survey.e[1],
          samples: NaN,
          desc: '精英率[1]：精一人数/持有人数',
        }
  }

  public elite2(character: Character): SurveyProps | null | undefined {
    const survey = this.smap[character.key]
    if (!survey) {
      return null
    }

    return survey.e[2] == null
      ? null
      : {
          percent: survey.e[2],
          samples: NaN,
          desc: '精英率[2]：精二人数/持有人数',
        }
  }

  public skill(
    character: Character,
    skill: Skill,
    realCharId: string,
    charSkillIndex: number,
  ): (SurveyProps | null | undefined)[] | null | undefined {
    const survey = this.smap[realCharId]
    if (!survey) {
      return null
    }

    const skillsSurveys = survey ? [survey.e2s1, survey.e2s2, survey.e2s3] : null
    if (!skillsSurveys) {
      return null
    }

    const ss = skillsSurveys[charSkillIndex]
    if (!ss) {
      return null
    }

    return [
      {
        desc: '专精了此技能的人数（一级及以上）/精二人数',
        percent: 1 - ss[0]!,
        samples: NaN,
      },
      {
        desc: '专精一级此技能的人数/专精了此技能的人数（一级及以上）',
        percent: ss[1]! / (1 - ss[0]!),
        samples: NaN,
      },
      {
        desc: '专精二级此技能的人数/专精了此技能的人数（一级及以上）',
        percent: ss[2]! / (1 - ss[0]!),
        samples: NaN,
      },
      {
        desc: '专精三级此技能的人数/专精了此技能的人数（一级及以上）',
        percent: ss[3]! / (1 - ss[0]!),
        samples: NaN,
      },
    ]
  }

  public mod(character: Character, equip: UniEquip): (SurveyProps | null | undefined)[] | null | undefined {
    const survey = this.smap[equip.raw.charId]
    if (!survey) {
      return null
    }

    const indexMatch = equip.key.match(/^uniequip_(\d+)_/)
    if (!indexMatch) {
      return null
    }

    const index = parseInt(indexMatch[1], 10)
    const ss = [survey.e2m1, survey.e2m2, survey.e2m3][index - 2]
    if (!ss) {
      return null
    }

    return [
      null,
      {
        desc: '解锁了此模组一级的人数/解锁了此模组的人数（一级及以上）',
        percent: ss[0]!,
        samples: NaN,
      },
      {
        desc: '解锁了此模组二级的人数/解锁了此模组的人数（一级及以上）',
        percent: ss[1]!,
        samples: NaN,
      },
      {
        desc: '解锁了此模组三级的人数/解锁了此模组的人数（一级及以上）',
        percent: ss[2]!,
        samples: NaN,
      },
    ]
  }

  public e2level(character: Character, range: 1 | 70 | 90): SurveyProps | null | undefined {
    const survey = this.smap[character.key]
    if (!survey) {
      return undefined
    }

    const sum = survey.e2l[0]! + survey.e2l[1]! + survey.e2l[2]!
    if (!Number.isFinite(sum)) {
      return undefined
    }

    if (range === 1) {
      return {
        percent: survey.e2l[0]! / sum,
        samples: NaN,
        desc: '精二 1~69 级人数/精二人数',
      }
    } else if (range === 70) {
      return {
        percent: survey.e2l[1]! / sum,
        samples: NaN,
        desc: '精二 70~89 级人数/精二人数',
      }
    } else {
      return {
        percent: survey.e2l[2]! / sum,
        samples: NaN,
        desc: '精二 90 级人数/精二人数',
      }
    }
  }
}
