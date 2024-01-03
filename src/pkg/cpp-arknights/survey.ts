import { ArknightsDataManager, Character, Skill, UniEquip } from './DataManager'

export type SurveyProps = { percent: number; samples: number; desc: string }

export class YituliuSurveySource {
  public static URL = 'https://yituliu.site/survey/operators'
  public static Name = '明日方舟一图流 干员练度统计数据'
  public static ShortName = '一图流练度统计'

  public constructor(public readonly dm: ArknightsDataManager) {}

  private get smap() {
    return this.dm.data.yituliuSurvey
  }

  private get scount() {
    return this.dm.raw.yituliuSurvey.userCount
  }

  public own(character: Character): SurveyProps | undefined {
    const survey = this.smap[character.key]
    if (!survey) {
      return undefined
    }

    return {
      percent: survey.own,
      samples: this.scount,
      desc: '干员持有数/总样本数',
    }
  }

  public elite0(character: Character): SurveyProps | undefined {
    const survey = this.smap[character.key]
    if (!survey) {
      return undefined
    }

    return {
      percent: survey.elite.rank0,
      samples: this.scount * survey.own,
      desc: '精零人数/持有人数',
    }
  }

  public elite1(character: Character): SurveyProps | undefined {
    const survey = this.smap[character.key]
    if (!survey) {
      return undefined
    }

    return {
      percent: survey.elite.rank1,
      samples: this.scount * survey.own,
      desc: '精一人数/持有人数',
    }
  }

  public elite2(character: Character): SurveyProps | undefined {
    const survey = this.smap[character.key]
    if (!survey) {
      return undefined
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
  ): SurveyProps[] | undefined {
    const survey = this.smap[realCharId]
    if (!survey) {
      return undefined
    }

    const skillsSurveys = survey ? [survey.skill1, survey.skill2, survey.skill3] : undefined
    if (!skillsSurveys) {
      return undefined
    }

    const ss = skillsSurveys[charSkillIndex]
    if (!ss) {
      return undefined
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

  public mod(character: Character, equip: UniEquip): SurveyProps[] | undefined {
    const survey = this.smap[equip.raw.charId]
    if (!survey) {
      return undefined
    }

    const modSurveys = survey
      ? ({
          X: survey.modX,
          Y: survey.modY,
          D: survey.modD,
        } as Record<string, ArknightsDataManager['raw']['yituliuSurvey']['result'][0]['modX']>)
      : undefined
    if (!modSurveys) {
      return undefined
    }

    const ss = modSurveys?.[equip.raw.typeName2!]
    if (!ss) {
      return undefined
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
}
