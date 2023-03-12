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

export interface ExcelBuildingData {
  controlSlotId: string
  meetingSlotId: string
  initMaxLabor: number
  laborRecoverTime: number
  manufactInputCapacity: number
  shopCounterCapacity: number
  comfortLimit: number
  creditInitiativeLimit: number
  creditPassiveLimit: number
  creditComfortFactor: number
  creditGuaranteed: number
  creditCeiling: number
  manufactUnlockTips: string
  shopUnlockTips: string
  manufactStationBuff: number
  comfortManpowerRecoverFactor: number
  manpowerDisplayFactor: number
  shopOutputRatio: null
  shopStackRatio: null
  basicFavorPerDay: number
  humanResourceLimit: number
  tiredApThreshold: number
  processedCountRatio: number
  tradingStrategyUnlockLevel: number
  tradingReduceTimeUnit: number
  tradingLaborCostUnit: number
  manufactReduceTimeUnit: number
  manufactLaborCostUnit: number
  laborAssistUnlockLevel: number
  apToLaborUnlockLevel: number
  apToLaborRatio: number
  socialResourceLimit: number
  socialSlotNum: number
  furniDuplicationLimit: number
  assistFavorReport: number
  manufactManpowerCostByNum: number[]
  tradingManpowerCostByNum: number[]
  roomUnlockConds: ExcelBuildingData.RoomUnlockConds
  rooms: ExcelBuildingData.Rooms
  layouts: ExcelBuildingData.Layouts
  prefabs: { [key: string]: ExcelBuildingData.Prefab }
  controlData: ExcelBuildingData.ControlData
  manufactData: ExcelBuildingData.ManufactData
  shopData: ExcelBuildingData.DormDataClass
  hireData: ExcelBuildingData.HireDataClass
  dormData: ExcelBuildingData.DormDataClass
  meetingData: ExcelBuildingData.MeetingData
  tradingData: ExcelBuildingData.HireDataClass
  workshopData: ExcelBuildingData.DormDataClass
  trainingData: ExcelBuildingData.HireDataClass
  powerData: ExcelBuildingData.HireDataClass
  chars: { [key: string]: ExcelBuildingData.Char }
  buffs: { [key: string]: ExcelBuildingData.Buff }
  workshopBonus: ExcelBuildingData.WorkshopBonus
  customData: ExcelBuildingData.CustomData
  manufactFormulas: { [key: string]: ExcelBuildingData.ManufactFormula }
  shopFormulas: ExcelBuildingData.ShopFormulas
  workshopFormulas: { [key: string]: ExcelBuildingData.WorkshopFormula }
  creditFormula: ExcelBuildingData.CreditFormula
  goldItems: { [key: string]: number }
  assistantUnlock: number[]
}

export namespace ExcelBuildingData {
  export interface Buff {
    buffId: string
    buffName: string
    buffIcon: string
    skillIcon: string
    sortId: number
    buffColor: string
    textColor: string
    buffCategory: string
    roomType: string
    description: string
  }

  export interface Char {
    charId: string
    maxManpower: number
    buffChar: BuffChar[]
  }

  export interface BuffChar {
    buffData: BuffDatum[]
  }

  export interface BuffDatum {
    buffId: string
    cond: Cond
  }

  export interface Cond {
    phase: number
    level: number
  }

  export interface ControlData {
    basicCostBuff: number
    phases: null
  }

  export interface CreditFormula {
    initiative: ShopFormulas
    passive: ShopFormulas
  }

  export interface ShopFormulas {}

  export interface CustomData {
    furnitures: { [key: string]: FurnitureValue }
    themes: { [key: string]: Theme }
    groups: { [key: string]: Group }
    types: { [key: string]: Type }
    subTypes: { [key: string]: SubType }
    defaultFurnitures: DefaultFurnitures
    interactGroups: InteractGroups
    diyUISortTemplates: DiyUISortTemplates
  }

  export interface DefaultFurnitures {
    room_dormitory_6x2: RoomDormitory6X2[]
  }

  export interface RoomDormitory6X2 {
    furnitureId: string
    xOffset: number
    yOffset: number
    defaultPrefabId: string
  }

  export interface DiyUISortTemplates {
    THEME: FURNITUREClass
    FURNITURE: FURNITUREClass
    FURNITURE_IN_THEME: FURNITUREClass
    RECENT_THEME: FURNITUREClass
    RECENT_FURNITURE: FURNITUREClass
  }

  export interface FURNITUREClass {
    FOLD: Expand
    EXPAND: Expand
  }

  export interface Expand {
    diyUIType: string
    expandState: string
    defaultTemplateIndex: number
    defaultTemplateOrder: string
    templates: Template[]
  }

  export interface Template {
    name: string
    sequences: string[]
    stableSequence: string
    stableSequenceOrder: string
  }

  export interface FurnitureValue {
    id: string
    sortId: number
    name: string
    iconId: string
    type: string
    subType: string
    location: string
    category: string
    validOnRotate: boolean
    enableRotate: boolean
    rarity: number
    themeId: string
    groupId: string
    width: number
    depth: number
    height: number
    comfort: number
    usage: string
    description: string
    obtainApproach: string
    processedProductId: string
    processedProductCount: number
    processedByProductPercentage: number
    processedByProductGroup: any[]
    canBeDestroy: boolean
    isOnly: number
    quantity: number
  }

  export interface Group {
    id: string
    sortId: number
    name: string
    themeId: string
    comfort: number
    count: number
    furniture: string[]
  }

  export interface InteractGroups {
    swimsuit: Swimsuit[]
  }

  export interface Swimsuit {
    skinId: string
  }

  export interface SubType {
    subType: string
    name: string
    type: string
    sortId: number
  }

  export interface Theme {
    id: string
    sortId: number
    name: string
    themeType: string
    desc: string
    quickSetup: QuickSetup[]
    groups: string[]
    furnitures: string[]
  }

  export interface QuickSetup {
    furnitureId: string
    pos0: number
    pos1: number
    dir: number
  }

  export interface Type {
    type: string
    name: string
  }

  export interface DormDataClass {
    phases: DormDataPhase[] | null
  }

  export interface DormDataPhase {
    manpowerRecover?: number
    decorationLimit?: number
    manpowerFactor?: number
  }

  export interface HireDataClass {
    basicSpeedBuff: number
    phases: HireDataPhase[] | null
  }

  export interface HireDataPhase {
    economizeRate?: number
    resSpeed?: number
    refreshTimes?: number
    orderSpeed?: number
    orderLimit?: number
    orderRarity?: number
    specSkillLvlLimit?: number
  }

  export interface Layouts extends Record<string, Layout> {}

  export interface Layout {
    id: string
    slots: { [key: string]: Slot }
    cleanCosts: CleanCosts
    storeys: Storeys
  }

  export interface CleanCosts extends Record<string, CleanCost> {}

  export interface CleanCost {
    id: string
    number: { [key: string]: NumberValue }
  }

  export interface NumberValue {
    items: Cost[]
  }

  export interface Cost {
    id: string
    count: number
    type: string
  }
  export interface Slot {
    id: string
    cleanCostId: string
    costLabor: number
    provideLabor: number
    size: BackWallGridSize
    offset: BackWallGridSize
    category: string
    storeyId: string
  }

  export interface BackWallGridSize {
    row: number
    col: number
  }

  export interface Storeys extends Record<string, Storey> {}

  export interface Storey {
    id: string
    yOffset: number
    unlockControlLevel: number
    type: string
  }

  export interface ManufactData {
    basicSpeedBuff: number
    phases: ManufactDataPhase[]
  }

  export interface ManufactDataPhase {
    speed: number
    outputCapacity: number
  }

  export interface ManufactFormula {
    formulaId: string
    itemId: string
    count: number
    weight: number
    costPoint: number
    formulaType: string
    buffType: string
    costs: Cost[]
    requireRooms: RequireRoom[]
    requireStages: any[]
  }

  export interface RequireRoom {
    roomId: string
    roomLevel: number
    roomCount: number
  }

  export interface MeetingData {
    basicSpeedBuff: number
    phases: MeetingDataPhase[]
  }

  export interface MeetingDataPhase {
    friendSlotInc: number
    maxVisitorNum: number
    gatheringSpeed: number
  }

  export interface Prefab {
    id: string
    blueprintRoomOverrideId: null
    size: BackWallGridSize
    floorGridSize: BackWallGridSize
    backWallGridSize: BackWallGridSize
    obstacleId: null
  }

  export interface RoomUnlockConds extends Record<string, RoomUnlockCond> {}

  export interface RoomUnlockCondNumber {
    type: string
    level: number
    count: number
  }

  export interface RoomUnlockCond {
    id: string
    number: { [key: string]: RoomUnlockCondNumber }
  }

  export interface Rooms {
    CONTROL: Control
    POWER: Control
    MANUFACTURE: Control
    TRADING: Control
    DORMITORY: Control
    WORKSHOP: Control
    HIRE: Control
    TRAINING: Control
    MEETING: Control
    ELEVATOR: Control
    CORRIDOR: Control
  }

  export interface Control {
    id: string
    name: string
    description: null | string
    defaultPrefabId: string
    canLevelDown: boolean
    maxCount: number
    category: string
    size: BackWallGridSize
    phases: CONTROLPhase[]
  }

  export interface CONTROLPhase {
    overrideName: null
    overridePrefabId: null
    unlockCondId: string
    buildCost: BuildCost
    electricity: number
    maxStationedNum: number
    manpowerCost: number
  }

  export interface BuildCost {
    items: Cost[]
    time: number
    labor: number
  }

  export interface WorkshopBonus {
    char_4019_ncdeer: string[]
  }

  export interface WorkshopFormula {
    sortId: number
    formulaId: string
    rarity: number
    itemId: string
    count: number
    goldCost: number
    apCost: number
    formulaType: string
    buffType: string
    extraOutcomeRate: number
    extraOutcomeGroup: ExtraOutcomeGroup[]
    costs: Cost[]
    requireRooms: RequireRoom[]
    requireStages: RequireStage[]
  }

  export interface ExtraOutcomeGroup {
    weight: number
    itemId: string
    itemCount: number
  }

  export interface RequireStage {
    stageId: string
    rank: number
  }
}
