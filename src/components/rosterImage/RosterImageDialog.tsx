import {
  Button,
  Checkbox,
  Classes,
  Dialog,
  DialogBody,
  DialogFooter,
  InputGroup,
  NonIdealState,
  NumericInput,
  SegmentedControl,
  Spinner,
} from '@blueprintjs/core'
import deepEqual from 'deep-equal'
import { useAtom, useAtomValue } from 'jotai'
import { memo, useEffect, useMemo, useState } from 'react'
import useEvent from 'react-use-event-hook'
import { useAtoms, useCpp, useGameAdapter, useGameDataGeneration, useStore } from '../../Cpp'
import { BlobFlavour } from '../../pkg/blobcache'
import { useComponents } from '../../hooks/useComponents'
import { IGame } from '../../pkg/cpp-basic'
import { gt } from '../../pkg/gt'
import { downloadBlob, rosterFileName } from '../download'
import { listedCharactersAtom } from '../listedCharacters'
import { useCoarsePointer, usePhoneLayout } from '../phoneLayout'
import { Measure, RosterEntry, RosterOptions, RosterTexts, buildRosterScene, rosterEntries } from './build'
import { ImageCache, ImageLookup, loadSceneImages } from './images'
import { RenderedPng, blobToDataUrl, renderPng, svgEmbed } from './paint'
import { MAX_COLUMNS, MIN_COLUMNS, clampColumns, clampHeader, rosterImagePrefsAtom } from './prefs'
import { RosterImagePainter, Scene, sceneToSvg } from './scene'

export type RosterImageSource = 'list' | 'selection'

const HEADER_DELAY = 300
const numbers = new Intl.NumberFormat('en-US')

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

const noPainter = (): RosterImagePainter | undefined => undefined

let measureContext: CanvasRenderingContext2D | null | undefined

/** 量字用一张 1×1 的 canvas；font 和画的时候是同一串 */
const measureText: Measure = (text, font) => {
  if (measureContext === undefined) {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    measureContext = canvas.getContext('2d')
  }
  if (!measureContext) return text.length * 14
  measureContext.font = font
  return measureContext.measureText(text).width
}

interface RenderJob {
  entries: RosterEntry[]
  options: RosterOptions
  painter: RosterImagePainter
  flavour: BlobFlavour
}

interface Rendered {
  job: RenderJob
  scene: Scene
  images: ImageLookup
  png: RenderedPng | null
  /** 预览用 data URL：微信、QQ 长按保存时由客户端去取图片地址，取不到页面里的 blob: */
  url?: string
  missing: number
}

export const RosterImageDialog = memo(
  ({ source = 'list', onClose }: { source?: RosterImageSource; onClose: () => void }) => {
    const cpp = useCpp()
    const ga = useGameAdapter<IGame>()
    const store = useStore<IGame>()
    const atoms = useAtoms<IGame>()
    const generation = useGameDataGeneration()
    // 入口只在游戏给了画法时出现，所以这个 hook 在对话框开着期间不会换
    const usePainter = useComponents().useRosterImagePainter ?? noPainter
    const painter = usePainter()
    const flavour = useAtomValue(cpp.preferenceAtoms.blobFlavourAtom)
    const listed = useAtomValue(listedCharactersAtom)
    const [prefs, setPrefs] = useAtom(rosterImagePrefsAtom)
    const [footer, setFooter] = useState(true)
    const [which, setWhich] = useState<RosterImageSource>(source)
    const phone = usePhoneLayout()
    const coarse = useCoarsePointer()

    const hasSelection = listed.selected.length > 0
    const drawSelection = hasSelection && which === 'selection'
    const keys = drawSelection ? listed.selected : listed.keys

    // 和列表的 CharacterMenu 一样从 store 现取
    const entries = useMemo(() => {
      void generation
      const uda = ga.getUserDataAdapter()
      return rosterEntries(keys, (key): RosterEntry | undefined => {
        let character
        try {
          character = ga.getCharacter(key)
        } catch {
          return undefined
        }
        if (!character) return undefined
        const current = store.get(atoms.currentCharacter(key))
        const goal = store.get(atoms.goalCharacter(key))
        return {
          key,
          character,
          current,
          goal,
          goalSame: deepEqual(current, goal, { strict: true }),
          absent: uda.isAbsentCharacter(character, current),
          finished: store.get(atoms.isCharacterFinished(key)),
        }
      })
    }, [keys, ga, store, atoms, generation])

    const header = useDebounced(prefs.header, HEADER_DELAY)
    const options = useMemo<RosterOptions>(
      () => ({ columns: prefs.columns, order: prefs.order, goal: prefs.goal, header, footer }),
      [prefs.columns, prefs.order, prefs.goal, header, footer],
    )

    const texts = useMemo<RosterTexts>(
      () => ({
        footer: gt.pgettext('roster image', '练度图由 Closure++ 生成'),
        current: gt.pgettext('roster image', '当前'),
        goal: gt.pgettext('roster image', '目标'),
      }),
      [],
    )

    const [cache] = useState<ImageCache>(() => new Map())
    const [rendered, setRendered] = useState<Rendered>()
    const [progress, setProgress] = useState<{ job: RenderJob; done: number; total: number }>()
    const [failedJob, setFailedJob] = useState<RenderJob>()
    const [svgBusy, setSvgBusy] = useState(false)

    // 每次要重画的就是一个新的 job；结果带着它的 job 回来，不是现在这个的就是在重画
    const job = useMemo<RenderJob | null>(
      () =>
        !listed.pending && !listed.failed && entries.length > 0 && painter
          ? { entries, options, painter, flavour }
          : null,
      [listed.pending, listed.failed, entries, options, painter, flavour],
    )
    useEffect(() => {
      if (!job) return
      // 后一次开始时，前一次的结果作废
      let live = true
      void (async () => {
        try {
          await document.fonts.ready
          if (!live) return
          const scene = buildRosterScene(job.entries, job.options, job.painter, measureText, texts)
          const { images, missing } = await loadSceneImages(scene, job.flavour, cache, (done, total) => {
            if (live) setProgress({ job, done, total })
          })
          if (!live) return
          const png = await renderPng(scene, images)
          if (!live) return
          const url = png ? await blobToDataUrl(png.blob) : undefined
          if (!live) return
          setRendered({ job, scene, images, png, url, missing })
        } catch (e) {
          console.error('Failed to render the roster image', e)
          if (live) setFailedJob(job)
        }
      })()
      return () => {
        live = false
      }
    }, [job, texts, cache])

    // 关掉以后解码好的图一并丢掉
    useEffect(() => () => cache.clear(), [cache])

    const downloadPng = useEvent(() => {
      if (rendered?.png) downloadBlob(rendered.png.blob, rosterFileName('png', new Date()))
    })

    const downloadSvg = useEvent(async () => {
      if (!rendered) return
      setSvgBusy(true)
      try {
        // 先让按钮转起来：嵌图要把每张图再编码一遍
        await new Promise((resolve) => setTimeout(resolve, 0))
        const svg = sceneToSvg(rendered.scene, svgEmbed(rendered.scene, rendered.images))
        downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), rosterFileName('svg', new Date()))
      } finally {
        setSvgBusy(false)
      }
    })

    const count = entries.length
    const description = (
      drawSelection
        ? gt.ngettext(
            '画选中的 %d 名干员，次序和列表一样。',
            '画选中的 %d 名干员，次序和列表一样。',
            count,
          ) /* I10N: %d: number */
        : gt.ngettext('画当前列表里的 %d 名干员，次序和列表一样。', '画当前列表里的 %d 名干员，次序和列表一样。', count)
    ) /* I10N: %d: number */
      .replaceAll('%d', String(count))

    const failed = job != null && failedJob === job
    const busy = job != null && !failed && rendered?.job !== job
    const showImage = job != null && !failed && rendered != null
    const png = showImage ? rendered.png : null
    const pngFailed = showImage && !busy && png == null
    const canDownload = showImage && !busy
    const loading = progress?.job === job ? progress : undefined
    const sizeText = png
      ? gt
          .gettext('PNG %d$width × %d$height px（%s 倍）') /* I10N: %d$width, %d$height: pixels; %s: scale, e.g. 1.5 */
          .replaceAll('%d$width', numbers.format(png.width))
          .replaceAll('%d$height', numbers.format(png.height))
          .replaceAll('%s', String(png.scale))
      : null

    let stage: React.ReactNode
    if (listed.failed) {
      stage = (
        <NonIdealState
          icon="warning-sign"
          title={gt.gettext('列表查询失败')}
          description={gt.gettext('列表上写着出错的原因。')}
        />
      )
    } else if (listed.pending) {
      stage = <NonIdealState icon={<Spinner />} description={gt.gettext('列表还在查询')} />
    } else if (count === 0) {
      stage = <NonIdealState icon="people" title={gt.gettext('当前列表里没有干员')} />
    } else if (failed || pngFailed) {
      stage = (
        <NonIdealState
          icon="error"
          title={gt.gettext('无法生成 PNG')}
          description={gt.gettext('图太大，或者浏览器内存不够。')}
        />
      )
    } else if (!png) {
      stage = (
        <NonIdealState
          icon={<Spinner />}
          description={
            loading
              ? gt
                  .gettext('正在载入图片 %d$done / %d$total') /* I10N: %d$done, %d$total: number of images */
                  .replaceAll('%d$done', String(loading.done))
                  .replaceAll('%d$total', String(loading.total))
              : null
          }
        />
      )
    } else {
      stage = (
        <>
          <div className="cpp-roster-image-preview">
            <img src={rendered?.url} alt={gt.gettext('练度图')} className={busy ? 'is-stale' : undefined} />
          </div>
          {busy ? (
            <div className="cpp-roster-image-overlay">
              <Spinner />
            </div>
          ) : null}
        </>
      )
    }

    const missing = showImage && !busy && !pngFailed && rendered.missing > 0 ? rendered.missing : 0
    const hint = coarse && showImage && !pngFailed ? gt.gettext('长按图片保存到相册') : null
    const notes = [
      missing
        ? gt
            .ngettext('%d 张图片没有载入，图里留空。', '%d 张图片没有载入，图里留空。', missing) /* I10N: %d: number */
            .replaceAll('%d', String(missing))
        : null,
      hint,
      // 手机上底栏只放两个按钮，尺寸写在提示的同一行
      phone ? sizeText : null,
    ].filter((x): x is string => !!x)

    const whichLabel = gt.gettext('画哪些')
    const orderLabel = gt.gettext('排列')

    return (
      <Dialog
        isOpen={true}
        onClose={onClose}
        title={gt.gettext('练度图')}
        icon="media"
        className="cpp-roster-image-dialog"
      >
        <DialogBody>
          <div className="cpp-roster-image-form">
            {hasSelection ? (
              <>
                <span>{whichLabel}</span>
                {/* SegmentedControl takes no aria props, so the group around it carries the name */}
                <div role="group" aria-label={whichLabel}>
                  <SegmentedControl
                    size="small"
                    intent="primary"
                    value={which}
                    options={[
                      { value: 'list', label: gt.gettext('当前列表') },
                      { value: 'selection', label: gt.gettext('选中的') },
                    ]}
                    onValueChange={(value) => setWhich(value as RosterImageSource)}
                  />
                </div>
              </>
            ) : null}
            <p className={`cpp-roster-image-description ${Classes.TEXT_MUTED}`}>{description}</p>
            <label htmlFor="cpp-roster-image-header">{gt.gettext('标题')}</label>
            <InputGroup
              id="cpp-roster-image-header"
              value={prefs.header}
              placeholder={gt.gettext('写在图顶上，例如博士的名字；不写就没有')}
              onValueChange={(value) => setPrefs((p) => ({ ...p, header: clampHeader(value) }))}
            />
            <label htmlFor="cpp-roster-image-columns">{gt.gettext('列数')}</label>
            <div className="cpp-roster-image-inline">
              <NumericInput
                id="cpp-roster-image-columns"
                className="cpp-roster-image-columns"
                value={prefs.columns}
                min={MIN_COLUMNS}
                max={MAX_COLUMNS}
                stepSize={1}
                minorStepSize={null}
                majorStepSize={null}
                clampValueOnBlur
                allowNumericCharactersOnly
                onValueChange={(value) => {
                  if (Number.isFinite(value)) setPrefs((p) => ({ ...p, columns: clampColumns(value) }))
                }}
              />
              <span className="cpp-roster-image-order">
                <span>{orderLabel}</span>
                <span role="group" aria-label={orderLabel}>
                  <SegmentedControl
                    size="small"
                    intent="primary"
                    value={prefs.order}
                    disabled={prefs.columns <= 1}
                    options={[
                      { value: 'rows', label: gt.gettext('先左右') },
                      { value: 'columns', label: gt.gettext('先上下') },
                    ]}
                    onValueChange={(value) =>
                      setPrefs((p) => ({ ...p, order: value === 'columns' ? 'columns' : 'rows' }))
                    }
                  />
                </span>
              </span>
            </div>
            <div className="cpp-roster-image-checks">
              <Checkbox
                checked={prefs.goal}
                label={gt.gettext('显示培养目标')}
                onChange={(e) => {
                  const checked = e.currentTarget.checked
                  setPrefs((p) => ({ ...p, goal: checked }))
                }}
              />
              <Checkbox
                checked={footer}
                label={gt.gettext('显示页脚')}
                onChange={(e) => setFooter(e.currentTarget.checked)}
              />
            </div>
          </div>
          <div className="cpp-roster-image-stage">{stage}</div>
          {notes.length ? (
            <div className={`cpp-roster-image-notes ${Classes.TEXT_MUTED}`}>
              {notes.map((note) => (
                <div key={note}>{note}</div>
              ))}
            </div>
          ) : null}
        </DialogBody>
        <DialogFooter
          actions={
            <>
              <Button
                icon="download"
                text={gt.gettext('下载 SVG')}
                disabled={!canDownload}
                loading={svgBusy}
                onClick={() => void downloadSvg()}
              />
              <Button
                icon="download"
                intent="primary"
                text={gt.gettext('下载 PNG')}
                disabled={!canDownload || !rendered?.png}
                onClick={downloadPng}
              />
            </>
          }
        >
          {phone ? null : <span className={Classes.TEXT_MUTED}>{sizeText}</span>}
        </DialogFooter>
      </Dialog>
    )
  },
)
