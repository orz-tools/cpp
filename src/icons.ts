import { IconName, IconNames, IconSize, Icons } from '@blueprintjs/icons'
import * as Paths16 from '@blueprintjs/icons/lib/esm/generated/16px/paths'
import * as Paths20 from '@blueprintjs/icons/lib/esm/generated/20px/paths'
import { AppToaster } from './components/Toaster'
import { DedupPool } from './pkg/dedup'

// cpp/bundled-icon (scripts/oxlint-plugin.js) reads the entries below as text, so keep them `[IconNames.X, PathsNN.X]`
const map = new Map<IconSize, Map<IconName, string[]>>([
  [
    IconSize.STANDARD,
    new Map([
      [IconNames.ADD, Paths16.Add],
      [IconNames.ARROW_DOWN, Paths16.ArrowDown],
      [IconNames.ARROW_RIGHT, Paths16.ArrowRight],
      [IconNames.ARROW_UP, Paths16.ArrowUp],
      [IconNames.BLANK, Paths16.Blank],
      [IconNames.BUILD, Paths16.Build],
      [IconNames.CALCULATOR, Paths16.Calculator],
      [IconNames.CALENDAR, Paths16.Calendar],
      [IconNames.CARET_DOWN, Paths16.CaretDown],
      [IconNames.CARET_LEFT, Paths16.CaretLeft],
      [IconNames.CARET_RIGHT, Paths16.CaretRight],
      [IconNames.CARET_UP, Paths16.CaretUp],
      [IconNames.CHART, Paths16.Chart],
      [IconNames.CHAT, Paths16.Chat],
      [IconNames.CHEVRON_DOWN, Paths16.ChevronDown],
      [IconNames.CHEVRON_LEFT, Paths16.ChevronLeft],
      [IconNames.CHEVRON_RIGHT, Paths16.ChevronRight],
      [IconNames.CHEVRON_UP, Paths16.ChevronUp],
      [IconNames.CLIPBOARD, Paths16.Clipboard],
      [IconNames.CONFIRM, Paths16.Confirm],
      [IconNames.CROSS, Paths16.Cross],
      [IconNames.CROSS_CIRCLE, Paths16.CrossCircle],
      [IconNames.CUBE, Paths16.Cube],
      [IconNames.DATABASE, Paths16.Database],
      [IconNames.DOCUMENT_OPEN, Paths16.DocumentOpen],
      [IconNames.DOUBLE_CHEVRON_DOWN, Paths16.DoubleChevronDown],
      [IconNames.DOUBLE_CHEVRON_LEFT, Paths16.DoubleChevronLeft],
      [IconNames.DOUBLE_CHEVRON_RIGHT, Paths16.DoubleChevronRight],
      [IconNames.DOUBLE_CHEVRON_UP, Paths16.DoubleChevronUp],
      [IconNames.DRAG_HANDLE_VERTICAL, Paths16.DragHandleVertical],
      [IconNames.DUPLICATE, Paths16.Duplicate],
      [IconNames.EDIT, Paths16.Edit],
      [IconNames.ENVELOPE, Paths16.Envelope],
      [IconNames.ERASER, Paths16.Eraser],
      [IconNames.ERROR, Paths16.Error],
      [IconNames.EXCHANGE, Paths16.Exchange],
      [IconNames.EYE_OFF, Paths16.EyeOff],
      [IconNames.FILTER, Paths16.Filter],
      [IconNames.FLAG, Paths16.Flag],
      [IconNames.FONT, Paths16.Font],
      [IconNames.FULLSCREEN, Paths16.Fullscreen],
      [IconNames.GLOBE, Paths16.Globe],
      [IconNames.GIT_REPO, Paths16.GitRepo],
      [IconNames.HELP, Paths16.Help],
      [IconNames.HISTORY, Paths16.History],
      [IconNames.HOME, Paths16.Home],
      [IconNames.ID_NUMBER, Paths16.IdNumber],
      [IconNames.IMAGE_ROTATE_RIGHT, Paths16.ImageRotateRight],
      [IconNames.IMPORT, Paths16.Import],
      [IconNames.INFO_SIGN, Paths16.InfoSign],
      [IconNames.KEY_COMMAND, Paths16.KeyCommand],
      [IconNames.LAB_TEST, Paths16.LabTest],
      [IconNames.LAYERS, Paths16.Layers],
      [IconNames.LOCK, Paths16.Lock],
      [IconNames.LOG_IN, Paths16.LogIn],
      [IconNames.LOG_OUT, Paths16.LogOut],
      [IconNames.MAXIMIZE, Paths16.Maximize],
      [IconNames.MEDIA, Paths16.Media],
      [IconNames.MORE, Paths16.More],
      [IconNames.MUGSHOT, Paths16.Mugshot],
      [IconNames.MULTI_SELECT, Paths16.MultiSelect],
      [IconNames.PEOPLE, Paths16.People],
      [IconNames.PIN, Paths16.Pin],
      [IconNames.PLUS, Paths16.Plus],
      [IconNames.PERSON, Paths16.Person],
      [IconNames.PREDICTIVE_ANALYSIS, Paths16.PredictiveAnalysis],
      [IconNames.PROPERTIES, Paths16.Properties],
      [IconNames.PULSE, Paths16.Pulse],
      [IconNames.REDO, Paths16.Redo],
      [IconNames.REFRESH, Paths16.Refresh],
      [IconNames.RESET, Paths16.Reset],
      [IconNames.SEARCH, Paths16.Search],
      [IconNames.SHARE, Paths16.Share],
      [IconNames.SHOP, Paths16.Shop],
      [IconNames.SMALL_TICK, Paths16.SmallTick],
      [IconNames.STAR, Paths16.Star],
      [IconNames.STAR_EMPTY, Paths16.StarEmpty],
      [IconNames.TH_DERIVED, Paths16.ThDerived],
      [IconNames.TICK, Paths16.Tick],
      [IconNames.TICK_CIRCLE, Paths16.TickCircle],
      [IconNames.TIME, Paths16.Time],
      [IconNames.TRANSLATE, Paths16.Translate],
      [IconNames.TRASH, Paths16.Trash],
      [IconNames.TRENDING_UP, Paths16.TrendingUp],
      [IconNames.UNDO, Paths16.Undo],
      [IconNames.WARNING_SIGN, Paths16.WarningSign],
    ]),
  ],
  [
    IconSize.LARGE,
    new Map([
      [IconNames.AUTOMATIC_UPDATES, Paths20.AutomaticUpdates],
      [IconNames.BOX, Paths20.Box],
      [IconNames.ERROR, Paths20.Error],
      [IconNames.FLAG, Paths20.Flag],
      [IconNames.IMPORT, Paths20.Import],
      [IconNames.MAP, Paths20.Map],
      [IconNames.MENU, Paths20.Menu],
      [IconNames.MUGSHOT, Paths20.Mugshot],
      [IconNames.PEOPLE, Paths20.People],
      [IconNames.SEARCH, Paths20.Search],
      [IconNames.TICK_CIRCLE, Paths20.TickCircle],
      [IconNames.WARNING_SIGN, Paths20.WarningSign],
    ]),
  ],
])

const pool = new DedupPool<`${IconName}-${IconSize}`>()

Icons.setLoaderOptions({
  loader: (name, size) => {
    return pool.run(`${name}-${size}`, () => {
      const value = map.get(size)?.get(name)
      if (value) return Promise.resolve(value)
      void AppToaster.then((toaster) =>
        toaster.show({
          icon: 'warning-sign',
          message: `missing icon ${name} ${size}, please report`,
          timeout: 0,
          intent: 'warning',
        }),
      )
      return Promise.resolve([])
    })
  },
})
