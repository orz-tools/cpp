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
