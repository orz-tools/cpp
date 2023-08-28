import { IconName, IconNames, IconSize, Icons } from '@blueprintjs/icons'
import * as Paths16 from '@blueprintjs/icons/lib/esm/generated/16px/paths'
import { AppToaster } from './components/Toaster'
import { DedupPool } from './pkg/dedup'

const map = new Map<IconSize, Map<IconName, string[]>>([
  [
    IconSize.STANDARD,
    new Map([
      [IconNames.ADD, Paths16.Add],
      [IconNames.BLANK, Paths16.Blank],
      [IconNames.BUILD, Paths16.Build],
      [IconNames.CALCULATOR, Paths16.Calculator],
      [IconNames.CHART, Paths16.Chart],
      [IconNames.CHEVRON_DOWN, Paths16.ChevronDown],
      [IconNames.CHEVRON_UP, Paths16.ChevronUp],
      [IconNames.CROSS, Paths16.Cross],
      [IconNames.CUBE, Paths16.Cube],
      [IconNames.DATABASE, Paths16.Database],
      [IconNames.DOUBLE_CHEVRON_DOWN, Paths16.DoubleChevronDown],
      [IconNames.DOUBLE_CHEVRON_UP, Paths16.DoubleChevronUp],
      [IconNames.ENVELOPE, Paths16.Envelope],
      [IconNames.ERROR, Paths16.Error],
      [IconNames.EYE_OFF, Paths16.EyeOff],
      [IconNames.FONT, Paths16.Font],
      [IconNames.FULLSCREEN, Paths16.Fullscreen],
      [IconNames.HOME, Paths16.Home],
      [IconNames.ID_NUMBER, Paths16.IdNumber],
      [IconNames.IMAGE_ROTATE_RIGHT, Paths16.ImageRotateRight],
      [IconNames.INFO_SIGN, Paths16.InfoSign],
      [IconNames.KEY_COMMAND, Paths16.KeyCommand],
      [IconNames.LAB_TEST, Paths16.LabTest],
      [IconNames.LAYERS, Paths16.Layers],
      [IconNames.LOG_IN, Paths16.LogIn],
      [IconNames.LOG_OUT, Paths16.LogOut],
      [IconNames.MEDIA, Paths16.Media],
      [IconNames.PEOPLE, Paths16.People],
      [IconNames.PERSON, Paths16.Person],
      [IconNames.PREDICTIVE_ANALYSIS, Paths16.PredictiveAnalysis],
      [IconNames.PROPERTIES, Paths16.Properties],
      [IconNames.PULSE, Paths16.Pulse],
      [IconNames.REDO, Paths16.Redo],
      [IconNames.REFRESH, Paths16.Refresh],
      [IconNames.TICK, Paths16.Tick],
      [IconNames.TIME, Paths16.Time],
      [IconNames.TRASH, Paths16.Trash],
      [IconNames.UNDO, Paths16.Undo],
      [IconNames.WARNING_SIGN, Paths16.WarningSign],
    ]),
  ],
  [IconSize.LARGE, new Map([])],
])

const pool = new DedupPool<`${IconName}-${IconSize}`>()

Icons.setLoaderOptions({
  loader: (name, size) => {
    return pool.run(`${name}-${size}`, () => {
      const value = map.get(size)?.get(name)
      if (value) return Promise.resolve(value)
      AppToaster.show({
        icon: 'warning-sign',
        message: `missing icon ${name} ${size}, please report`,
        timeout: 0,
        intent: 'warning',
      })
      return Promise.resolve([])
    })
  },
})
