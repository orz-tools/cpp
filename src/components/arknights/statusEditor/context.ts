import type { Draft } from 'immer'
import React, { useContext } from 'react'
import type { ArknightsCharacterStatus, ArknightsDataManager, Character } from '../../../pkg/cpp-arknights'
import type { SurveySource } from '../../../pkg/cpp-arknights/survey'

export interface EditorContextValue {
  character: Character
  status: ArknightsCharacterStatus
  /** The current status while editing a goal: cells below it are gray and cannot be picked */
  current?: ArknightsCharacterStatus
  setStatus: (recipe: (draft: Draft<ArknightsCharacterStatus>) => void) => void
  dm: ArknightsDataManager
  survey: SurveySource | null
  /** 一图流 or 小黑盒, for the statistics' tooltips */
  surveyName: string
  /** The one (i) panel that is open, by key */
  openDetail: string | null
  toggleDetail: (key: string) => void
}

export const EditorContext = React.createContext<EditorContextValue>(undefined as any)

export function useEditor() {
  return useContext(EditorContext)
}
