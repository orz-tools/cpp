export interface ExcelCharacterTable extends Record<string, ExcelCharacterTable.Character> {}

export namespace ExcelCharacterTable {
  export interface Data {
    maxHp: number
    atk: number
    def: number
    magicResistance: number
    cost: number
    blockCnt: number
    moveSpeed: number
    attackSpeed: number
    baseAttackTime: number
    respawnTime: number
    hpRecoveryPerSec: number
    spRecoveryPerSec: number
    maxDeployCount: number
    maxDeckStackCnt: number
    tauntLevel: number
    massLevel: number
    baseForceLevel: number
    stunImmune: boolean
    silenceImmune: boolean
    sleepImmune: boolean
    frozenImmune: boolean
    levitateImmune: boolean
  }

  export interface AttributesKeyFrame {
    level: number
    data: Data
  }

  export interface EvolveCost {
    id: string
    count: number
    type: string
  }

  export interface Phase {
    characterPrefabKey: string
    rangeId: string
    maxLevel: number
    attributesKeyFrames: AttributesKeyFrame[]
    evolveCost: EvolveCost[]
  }

  export interface UnlockCond {
    phase: number
    level: number
  }

  export interface LevelUpCost {
    id: string
    count: number
    type: string
  }

  export interface LevelUpCostCond {
    unlockCond: UnlockCond
    lvlUpTime: number
    levelUpCost: LevelUpCost[]
  }

  export interface Skill {
    skillId: string
    overridePrefabKey?: any
    overrideTokenKey?: any
    levelUpCostCond: LevelUpCostCond[]
    unlockCond: UnlockCond
  }

  export interface UnlockCondition {
    phase: number
    level: number
  }

  export interface Blackboard {
    key: string
    value: number
  }

  export interface Candidate {
    unlockCondition: UnlockCondition
    requiredPotentialRank: number
    prefabKey: string
    name: string
    description: string
    rangeId?: any
    blackboard: Blackboard[]
  }

  export interface Talent {
    candidates: Candidate[]
  }

  export interface FavorKeyFrame {
    level: number
    data: Data
  }

  export interface LvlUpCost {
    id: string
    count: number
    type: string
  }

  export interface AllSkillLvlup {
    unlockCond: UnlockCond
    lvlUpCost: LvlUpCost[]
  }

  export interface Character {
    name: string
    description: string
    canUseGeneralPotentialItem: boolean
    canUseActivityPotentialItem: boolean
    potentialItemId?: any
    activityPotentialItemId?: any
    nationId: string
    groupId?: any
    teamId?: any
    displayNumber: string
    tokenKey?: any
    appellation: string
    position: string
    tagList: string[]
    itemUsage: string
    itemDesc: string
    itemObtainApproach: string
    isNotObtainable: boolean
    isSpChar: boolean
    maxPotentialLevel: number
    rarity: number
    profession: string
    subProfessionId: string
    trait?: any
    phases: Phase[]
    skills: Skill[]
    talents: Talent[]
    potentialRanks: any[]
    favorKeyFrames: FavorKeyFrame[]
    allSkillLvlup: AllSkillLvlup[]
  }
}

export interface ExcelPatchCharacterTable {
  infos: Record<
    string,
    {
      tmplIds: string[]
      default: string
    }
  >
  patchChars: Record<string, ExcelCharacterTable.Character>
  unlockConds: Record<
    string,
    {
      conds: {
        stageId: string
        completeState: number
      }[]
    }
  >
  patchDetailInfoList: Record<
    string,
    {
      patchId: string
      sortId: number
      infoParam: string
    }
  >
}

export interface ExcelSkillTable extends Record<string, ExcelSkillTable.Skill> {}

export namespace ExcelSkillTable {
  export interface SpData {
    spType: number
    levelUpCost?: any
    maxChargeTime: number
    spCost: number
    initSp: number
    increment: number
  }

  export interface Blackboard {
    key: string
    value: number
  }

  export interface Level {
    name: string
    rangeId?: any
    description: string
    skillType: number
    durationType: number
    spData: SpData
    prefabId: string
    duration: number
    blackboard: Blackboard[]
  }

  export interface Skill {
    skillId: string
    iconId?: any
    hidden: boolean
    levels: Level[]
  }
}

export interface ExcelUniEquipTable {
  equipDict: Record<string, ExcelUniEquipTable.UniEquip>
  missionList: Record<string, ExcelUniEquipTable.UniEquipMission>
  subProfDict: Record<string, ExcelUniEquipTable.SubProfession>
  charEquip: Record<string, string[]>
  equipTrackDict: ExcelUniEquipTable.EquipTrack[]
}
export namespace ExcelUniEquipTable {
  export interface TrackList {
    charId: string
    equipId: string
  }

  export interface EquipTrack {
    timeStamp: number
    trackList: TrackList[]
  }

  export interface SubProfession {
    subProfessionId: string
    subProfessionName: string
    subProfessionCatagory: number
  }
  export interface UniEquipMission {
    template: string
    desc: string
    paramList: string[]
    uniEquipMissionId: string
    uniEquipMissionSort: number
    uniEquipId: string
    jumpStageId: string
  }

  export interface ItemCost {
    id: string
    count: number
    type: string
  }

  export interface PerLevelItemCosts extends Record<number, ItemCost[]> {}

  export interface UniEquip {
    uniEquipId: string
    uniEquipName: string
    uniEquipIcon: string
    uniEquipDesc: string
    typeIcon: string
    typeName1: string
    typeName2: string
    equipShiningColor: string
    showEvolvePhase: number
    unlockEvolvePhase: number
    charId: string
    tmplId?: any
    showLevel: number
    unlockLevel: number
    unlockFavorPoint: number
    missionList: string[]
    itemCost: PerLevelItemCosts
    type: string
    uniEquipGetTime: number
    charEquipOrder: number
  }
}
