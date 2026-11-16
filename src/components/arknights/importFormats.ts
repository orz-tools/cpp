import { useGameAdapter } from '../../Cpp'
import { Arknights } from '../../pkg/cpp-arknights'
import {
  detectArkntoolsBackup,
  detectMAADepot,
  detectMAAOperBox,
  detectMaaOperProgress,
  detectSkland,
} from '../../pkg/cpp-arknights/importDetect'
import { ImportFormat } from '../Importer'
import {
  importFormatLabels,
  useArkntoolsImport,
  useMAADepotImport,
  useMAAOperBoxImport,
  useMaaOperProgressImport,
  useSklandImport,
} from './importHooks'

function format<T>(label: string, detect: (text: string) => T | undefined, start: (data: T) => void): ImportFormat {
  return {
    label,
    match: (text) => {
      const data = detect(text)
      return data === undefined ? undefined : { start: () => start(data) }
    },
  }
}

// 顺序有意义：第一个认出的格式胜出，仓库识别收得最宽，放最后
export function useArknightsImportFormats(): ImportFormat[] {
  const ga = useGameAdapter<Arknights>()
  const importArkntools = useArkntoolsImport()
  const importSkland = useSklandImport()
  const importMAAOperBox = useMAAOperBoxImport()
  const importMaaOperProgress = useMaaOperProgressImport()
  const importMAADepot = useMAADepotImport()
  return [
    format(importFormatLabels.arkntools(), detectArkntoolsBackup, importArkntools),
    format(importFormatLabels.skland(), detectSkland, importSkland),
    format(importFormatLabels.maaOperBox(), detectMAAOperBox, importMAAOperBox),
    format(importFormatLabels.maaOperProgress(), detectMaaOperProgress, importMaaOperProgress),
    format(importFormatLabels.maaDepot(), (text) => detectMAADepot(text, (id) => !!ga.getItem(id)), importMAADepot),
  ]
}
