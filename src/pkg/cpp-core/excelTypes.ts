export interface ExcelCharacterTable extends Record<string, ExcelCharacterTable.Character> {}

export namespace ExcelCharacterTable {
  export interface AllSkillLvlup {
    unlockCond: UnlockCond
    lvlUpCost: Cost[] | null
  }

  export interface Cost {
    id: string
    count: number
    type: string
  }

  export interface UnlockCond {
    phase: number
    level: number
  }

  export interface KeyFrame {
    level: number
    data: Data
  }

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

  export interface Phase {
    characterPrefabKey: string
    rangeId: null | string
    maxLevel: number
    attributesKeyFrames: KeyFrame[]
    evolveCost: Cost[] | null
  }

  export enum Position {
    All = 'ALL',
    Melee = 'MELEE',
    None = 'NONE',
    Ranged = 'RANGED',
  }

  export interface PotentialRank {
    type: number
    description: string
    buff: Buff | null
    equivalentCost: null
  }

  export interface Buff {
    attributes: Attributes
  }

  export interface Attributes {
    abnormalFlags: null
    abnormalImmunes: null
    abnormalAntis: null
    abnormalCombos: null
    abnormalComboImmunes: null
    attributeModifiers: AttributeModifier[]
  }

  export interface AttributeModifier {
    attributeType: number
    formulaItem: number
    value: number
    loadFromBlackboard: boolean
    fetchBaseValueFromSourceEntity: boolean
  }

  export enum Profession {
    Caster = 'CASTER',
    Medic = 'MEDIC',
    Pioneer = 'PIONEER',
    Sniper = 'SNIPER',
    Special = 'SPECIAL',
    Support = 'SUPPORT',
    Tank = 'TANK',
    Token = 'TOKEN',
    Trap = 'TRAP',
    Warrior = 'WARRIOR',
  }

  export interface Skill {
    skillId: null | string
    overridePrefabKey: null | string
    overrideTokenKey: null | string
    levelUpCostCond: LevelUpCostCond[]
    unlockCond: UnlockCond
  }

  export interface LevelUpCostCond {
    unlockCond: UnlockCond
    lvlUpTime: number
    levelUpCost: Cost[] | null
  }

  export interface Talent {
    candidates: TalentCandidate[] | null
  }

  export interface TalentCandidate {
    unlockCondition: UnlockCond
    requiredPotentialRank: number
    prefabKey: string
    name: null | string
    description: null | string
    rangeId: null | string
    blackboard: PurpleBlackboard[]
  }

  export interface PurpleBlackboard {
    key: string
    value?: number
    valueStr?: string
  }

  export interface Trait {
    candidates: TraitCandidate[]
  }

  export interface TraitCandidate {
    unlockCondition: UnlockCond
    requiredPotentialRank: number
    blackboard: FluffyBlackboard[]
    overrideDescripton: null | string
    prefabKey: null | string
    rangeId: null | string
  }

  export interface FluffyBlackboard {
    key: string
    value: number
  }

  export interface Character {
    name: string
    description: null | string
    canUseGeneralPotentialItem: boolean
    canUseActivityPotentialItem: boolean
    potentialItemId: null | string
    nationId: null | string
    teamId: null | string
    displayNumber: null | string
    appellation: string
    position: Position
    tagList: string[] | null
    itemUsage: null | string
    itemDesc: null | string
    itemObtainApproach: string | null
    isNotObtainable: boolean
    isSpChar: boolean
    maxPotentialLevel: number
    rarity: number
    profession: Profession
    subProfessionId: string
    trait: Trait | null
    phases: Phase[]
    skills: Skill[]
    potentialRanks: PotentialRank[]
    favorKeyFrames: KeyFrame[] | null
    allSkillLvlup: AllSkillLvlup[]
    groupId: null | string
    activityPotentialItemId: null | string
    tokenKey: null | string
    talents: Talent[]
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

export interface ExcelItemTable {
  items: { [key: string]: ExcelItemTable.Item }
  expItems: { [key: string]: ExcelItemTable.ExpItem }
  potentialItems: { [key: string]: ExcelItemTable.PotentialItem }
  apSupplies: { [key: string]: ExcelItemTable.ApSupply }
  uniqueInfo: { [key: string]: number }
  itemTimeLimit: { [key: string]: number }
  uniCollectionInfo: { [key: string]: ExcelItemTable.UniCollectionInfo }
  itemPackInfos: { [key: string]: ExcelItemTable.ItemPackInfo }
  fullPotentialCharacters: { [key: string]: ExcelItemTable.FullPotentialCharacter }
  activityPotentialCharacters: ExcelItemTable.ActivityPotentialCharacters
}

export namespace ExcelItemTable {
  export interface ActivityPotentialCharacters {
    voucher_vigil: VoucherVigil
  }

  export interface VoucherVigil {
    charId: string
  }

  export interface ApSupply {
    id: string
    ap: number
    hasTs: boolean
  }

  export interface ExpItem {
    id: string
    gainExp: number
  }

  export interface FullPotentialCharacter {
    itemId: string
    ts: number
  }

  export interface ItemPackInfo {
    packId: string
    content: Content[]
  }

  export interface Content {
    id: string
    count: number
    type: Type
  }

  export enum Type {
    Furn = 'FURN',
    LinkageTktGacha10 = 'LINKAGE_TKT_GACHA_10',
    Material = 'MATERIAL',
    PlayerAvatar = 'PLAYER_AVATAR',
  }

  export interface Item {
    itemId: string
    name: string
    description: null | string
    rarity: number
    iconId: string
    overrideBkg: null
    stackIconId: null | string
    sortId: number
    usage: null | string
    obtainApproach: null | string
    classifyType: ClassifyType
    itemType: string
    stageDropList: StageDropList[]
    buildingProductList: BuildingProductList[]
    hideInItemGet?: boolean
  }

  export interface BuildingProductList {
    roomType: RoomType
    formulaId: string
  }

  export enum RoomType {
    Manufacture = 'MANUFACTURE',
    Workshop = 'WORKSHOP',
  }

  export enum ClassifyType {
    Consume = 'CONSUME',
    Material = 'MATERIAL',
    None = 'NONE',
    Normal = 'NORMAL',
  }

  export interface StageDropList {
    stageId: string
    occPer: OccPer
  }

  export enum OccPer {
    Almost = 'ALMOST',
    Always = 'ALWAYS',
    Often = 'OFTEN',
    Sometimes = 'SOMETIMES',
    Usual = 'USUAL',
  }

  export interface PotentialItem {
    PIONEER: string
    WARRIOR: string
    SNIPER: string
    TANK: string
    MEDIC: string
    SUPPORT: string
    CASTER: string
    SPECIAL: string
  }

  export interface UniCollectionInfo {
    uniCollectionItemId: string
    uniqueItem: Content[]
  }
}
