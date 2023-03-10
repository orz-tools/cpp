export interface UserData {
  current: Record<string, CharacterStatus>
  target: Record<string, CharacterStatus>
}

export interface CharacterStatus {
  elite: number
  level: number
  skillLevel: number
  skillMaster: Record<string, number>
  modLevel: Record<string, number>
}

export interface CharacterLevel {
  elite: number
  level: number
}
