import {
  Alignment,
  AnchorButton,
  Button,
  Callout,
  Classes,
  ContextMenu,
  Dialog,
  DialogBody,
  DialogFooter,
  Menu,
  MenuDivider,
  MenuItem,
  Navbar,
  Popover,
  Spinner,
  Tag,
} from '@blueprintjs/core'
import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai'
import React, { ErrorInfo, memo, useEffect, useRef, useState } from 'react'
import useEvent from 'react-use-event-hook'
import './App.css'
import { useAtoms, useCpp, useGameAdapter } from './Cpp'
import { HelpButton } from './components/AboutList'
import { Chamber, ChamberPortal } from './components/Chamber'
import { CharacterDossier } from './components/CharacterDossier'
import { CharacterList } from './components/CharacterList'
import { ConfigButton, MaybeSoulButton, RegionButton } from './components/ConfigUi'
import { Err, ErrAtom } from './components/Err'
import { FarmList } from './components/FarmList'
import { ImportPasteBox } from './components/ImportPasteBox'
import { ItemList } from './components/ItemList'
import { PeekBoard } from './components/Peek'
import { ProfileMenu, ProfileTitle } from './components/Profile'
import { Sidebar } from './components/Sidebar'
import { TaskList } from './components/TaskList'
import { AppToaster } from './components/Toaster'
import { UserDataManagerButton, UserDataManagerMenuItem } from './components/UserDataManager'
import { ValueOptionButton } from './components/Value'
import { useComponents } from './hooks/useComponents'
import { LocaleButton } from './locales'
import { UpdateResult, UpdateScheduler } from './pkg/cpp-basic'
import { gt } from './pkg/gt'
import { formatProfileName } from './profiles'

const UndoButtons = memo(() => {
  const atoms = useAtoms()
  const setData = useSetAtom(atoms.dataAtom)
  const undoCounter = useAtomValue(atoms.undoCounterAtom)
  const redoCounter = useAtomValue(atoms.redoCounterAtom)

  return (
    <>
      <Button
        icon="undo"
        disabled={undoCounter === 0}
        text={<span className={'cpp-very-compact'}>{gt.gettext('撤销')}</span>}
        variant="minimal"
        onClick={() => setData('undo')}
        endIcon={undoCounter > 0 ? <Tag round={true}>{undoCounter}</Tag> : undefined}
      />
      <Button
        icon="redo"
        disabled={redoCounter === 0}
        text=""
        variant="minimal"
        onClick={() => setData('redo')}
        endIcon={redoCounter > 0 ? <Tag round={true}>{redoCounter}</Tag> : undefined}
      />
    </>
  )
})

const ReloadDataButton = memo(() => {
  const cpp = useCpp()
  const dm = cpp.gameAdapter.getDataManager()
  const { updating } = useAtomValue(cpp.gameDataStatusAtom)
  const setError = useSetAtom(ErrAtom)
  const run = useEvent(async (operation: () => Promise<UpdateResult>) => {
    const toaster = await AppToaster
    const reload = toaster.show(
      { message: gt.gettext('更新数据中…'), isCloseButtonShown: false, timeout: 0, intent: 'primary' },
      'reload',
    )
    try {
      const r = await operation()
      // Replaced in place: a dismiss followed by a show with the same key drops both, as the dismiss lands last.
      if (r.applied) {
        toaster.show({ message: gt.gettext('游戏数据已更新'), intent: 'success' }, reload)
      } else {
        toaster.show({ message: gt.gettext('未找到新数据') }, reload)
      }
    } catch (e) {
      console.log(e)
      toaster.dismiss(reload)
      setError({ error: e, context: gt.pgettext('error context', '检查数据更新失败') })
    }
  })

  return (
    <>
      <ContextMenu
        content={
          <Menu>
            <MenuItem
              text={gt.gettext('重载数据')}
              icon={'reset'}
              disabled={updating}
              onClick={() => void run(() => dm.reset())}
            />
          </Menu>
        }
      >
        <Button
          icon="refresh"
          disabled={updating}
          text={<span className={'cpp-very-compact'}>{gt.gettext('检查数据更新')}</span>}
          variant="minimal"
          onClick={() => void run(() => dm.update({ force: true }))}
        />
      </ContextMenu>
    </>
  )
})

const ClosureButtonHeading = memo(() => {
  const cpp = useCpp()
  const ga = useGameAdapter()
  return (
    <Navbar.Heading style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
      <img src="/favicon.png" alt="Closure++ logo" width="24" height="24" title="" style={{ marginRight: 4 }} />
      <code>{`Closure`}</code>
      <Popover
        usePortal={true}
        minimal={true}
        content={
          <Menu>
            <ProfileMenu />
          </Menu>
        }
        position="bottom-left"
      >
        <Button variant="minimal" style={{ paddingLeft: 0, paddingRight: 0 }}>
          <ProfileTitle codename={ga.getCodename()} profile={cpp.instanceName} />
        </Button>
      </Popover>
      <code>{`++`}</code>
      {/* <code>{`Closure++`}</code> */}
    </Navbar.Heading>
  )
})

const charExtraWidthAtom = atom(0)

const App = memo(() => {
  const cpp = useCpp()
  const defaultCharStatusWidth = 43 * 6
  const charExtraWidth = useAtomValue(charExtraWidthAtom)
  const charStatusWidth = cpp.gameComponent.charStatusWidth || defaultCharStatusWidth
  const charListBaseWidth = 730 - defaultCharStatusWidth * 2 + charStatusWidth * 2
  const dm = cpp.gameAdapter.getDataManager()

  useEffect(() => {
    const scheduler = new UpdateScheduler({
      check: async () => {
        const { notify } = await dm.update({})
        if (notify) (await AppToaster).show({ message: gt.gettext('游戏数据已更新'), intent: 'success' }, 'auto-update')
      },
      onVisible: () => void dm.checkExpiry().catch((e) => console.error('Failed to rebuild expired game data', e)),
    })
    scheduler.start()
    return () => scheduler.stop()
  }, [dm])

  return (
    <>
      {cpp.gameComponent.style ? <style dangerouslySetInnerHTML={{ __html: cpp.gameComponent.style }} /> : null}
      <Navbar fixedToTop={true} className="cpp-navbar-main">
        <Navbar.Group align={Alignment.LEFT}>
          <ClosureButtonHeading />
          <Navbar.Divider />
          <UndoButtons />
          <Navbar.Divider />
          <ValueOptionButton />
          <ConfigButton />
          <MaybeSoulButton />
        </Navbar.Group>
        <Navbar.Group align={Alignment.RIGHT}>
          <RegionButton />
          <DataDropdown />
          <ReloadDataButton />
          <HelpButton />
          <LocaleButton />
        </Navbar.Group>
      </Navbar>
      <div className="App">
        <Sidebar />
        <section
          className={Classes.ELEVATION_1}
          style={{
            width: Math.max(charListBaseWidth + charExtraWidth, 560),
            display: 'flex',
            flexDirection: 'column',
            // 过滤器编辑器的条件区和 JSON 区按没有附加列时的宽度排版，加列、拖列宽时控件不跟着变宽
            ['--cpp-char-list-base-width' as string]: `${Math.max(charListBaseWidth, 560)}px`,
          }}
        >
          <CharacterList charExtraWidthAtom={charExtraWidthAtom} />
        </section>
        <section
          className={Classes.ELEVATION_1}
          style={{
            width: '270px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <TaskList />
        </section>
        <section
          className={Classes.ELEVATION_1}
          style={{
            width: '470px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <FarmList />
        </section>
        <section
          className={Classes.ELEVATION_1}
          style={{
            width: '720px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <ItemList />
        </section>
      </div>
      <CharacterDossier />
      <PeekBoard />
    </>
  )
})

interface DataMenuProps {
  pasteBoxRef: React.Ref<HTMLInputElement>
  onImported: () => void
}

const DataMenu = memo(({ pasteBoxRef, onImported }: DataMenuProps) => {
  const { ImporterMenuItems, ExporterMenuItems } = useComponents()
  return (
    <Menu>
      <ImportPasteBox inputRef={pasteBoxRef} onImported={onImported} />
      <UserDataManagerMenuItem />
      {ImporterMenuItems ? <MenuDivider /> : null}
      {ImporterMenuItems ? <ImporterMenuItems /> : null}
      {ExporterMenuItems ? <MenuDivider /> : null}
      {ExporterMenuItems ? <ExporterMenuItems /> : null}
    </Menu>
  )
})

const DataDropdown = memo(() => {
  const [isOpen, setIsOpen] = useState(false)
  const pasteBoxRef = useRef<HTMLInputElement>(null)
  // A touch device would raise its keyboard on every open; there the box still takes a long-press paste.
  const focusPasteBox = useEvent(() => {
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) pasteBoxRef.current?.focus()
  })
  const close = useEvent(() => setIsOpen(false))
  return (
    <Popover
      usePortal={true}
      minimal={true}
      isOpen={isOpen}
      onInteraction={(next) => setIsOpen(next)}
      onOpened={focusPasteBox}
      content={<DataMenu pasteBoxRef={pasteBoxRef} onImported={close} />}
      position="bottom-right"
    >
      {/* Blueprint marks the target active only for uncontrolled popovers */}
      <Button icon={'th-derived'} variant="minimal" endIcon={'chevron-down'} active={isOpen}>
        <span className="cpp-very-compact">{gt.gettext('导入/导出')}</span>
      </Button>
    </Popover>
  )
})

const SuperAppWrapper = memo(() => {
  const { status, error } = useAtomValue(useCpp().gameDataStatusAtom)

  if (status === 'error') throw error

  if (status === 'loading') {
    return <Loading />
  }

  return <App />
})

export const Loading = memo(() => {
  const { status: dataStatus, loading } = useAtomValue(useCpp().gameDataStatusAtom)
  const [started, setStarted] = useState(false)
  if (loading.length > 0 && !started) setStarted(true)
  const status =
    dataStatus !== 'loading'
      ? gt.pgettext('loading status', '马上就好…') /* I10N: done */
      : loading.length > 0
        ? gt
            .pgettext(
              'loading status',
              `仍在加载 %s 中…`,
            ) /* I10N: loading data objects, %s: names of pending data objects */
            .replaceAll('%s', loading.join(', '))
        : started
          ? gt.pgettext('loading status', '收拾中…') /* I10N: loaded data objects */
          : gt.pgettext('loading status', '别急…') /* I10N: initial */

  return (
    <>
      <Navbar fixedToTop={true}>
        <Navbar.Group align={Alignment.LEFT}>
          <ClosureButtonHeading />
        </Navbar.Group>
        <Navbar.Group align={Alignment.RIGHT}>
          <HelpButton />
          <LocaleButton />
        </Navbar.Group>
      </Navbar>
      <div
        className="App"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'auto',
          flexDirection: 'column',
        }}
      >
        <Spinner size={100} />
        <h2 style={{ textAlign: 'center' }}>
          <del>{gt.pgettext('loading status', '海记忆体知己，天涯霍位元人') /* I10N: joke text */}</del>
          <br />
          {gt
            .pgettext(
              'loading status',
              '我们正在准备您的 %s',
            ) /* I10N: loading hero line 1, %s: Product Name (Closure++) */
            .replaceAll('%s', 'Closure++')}
          <br />
          {gt.pgettext('loading status', '请稍候') /* I10N: loading hero line 2 */}
        </h2>
        {status ? (
          <div style={{ opacity: 0.5, position: 'absolute', textAlign: 'center', bottom: '5%', left: 0, right: 0 }}>
            {status}
          </div>
        ) : null}
      </div>
    </>
  )
})

export const AppWrapper = memo(() => {
  const c = useCpp()
  const codename = c.gameAdapter.getCodename()
  const instanceName = c.instanceName
  return (
    <>
      <Chamber>
        <ErrDialog codename={codename} instanceName={instanceName} />
        <ErrorBoundary codename={codename} instanceName={instanceName}>
          <Chamber>
            <SuperAppWrapper />
            <ChamberPortal />
          </Chamber>
        </ErrorBoundary>
        <ChamberPortal />
      </Chamber>
    </>
  )
})

class ErrorBoundary extends React.Component<
  { children: React.ReactNode; instanceName: string; codename: string },
  { hasError: boolean; error?: Error }
> {
  public constructor(props: { children: React.ReactNode; instanceName: string; codename: string }) {
    super(props)
    this.state = { hasError: false }
  }

  public static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('error occurred!', error, errorInfo)
  }

  private readonly reset = () => this.setState({ hasError: false, error: undefined })

  public render() {
    if (this.state.hasError) {
      return (
        <Dialog
          isOpen
          title={`Closure${formatProfileName(this.props.codename, this.props.instanceName)}++ ${gt.pgettext(
            'error context',
            `遇到错误`,
          )}`}
          icon="warning-sign"
          isCloseButtonShown={false}
        >
          <ResetOnDataChange onChange={this.reset} />
          <DialogBody>{renderError({ error: this.state.error! })}</DialogBody>
          <DialogFooter
            actions={
              <>
                <AnchorButton href={'/'} variant="minimal" icon={'home'}>
                  {gt.gettext('返回主页')}
                </AnchorButton>
              </>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'row' }}>
              <Button variant="minimal" disabled>
                {gt.gettext('您不妨试试')}
              </Button>
              <ReloadDataButton />
              <UserDataManagerButton />
              <LocaleButton />
            </div>
          </DialogFooter>
        </Dialog>
      )
    }

    return this.props.children
  }
}

/** Mounted only while the boundary shows an error: new game data or replaced user data may be what fixes it. */
const ResetOnDataChange = memo(({ onChange }: { onChange: () => void }) => {
  const cpp = useCpp()
  const generation = useAtomValue(cpp.gameDataGenerationAtom)
  const data = useAtomValue(cpp.atoms.atoms.dataAtom)
  const [initial] = useState({ generation, data })
  useEffect(() => {
    if (generation !== initial.generation || data !== initial.data) onChange()
  }, [generation, data, initial, onChange])
  return null
})

export const ErrDialog = memo(({ instanceName, codename }: { instanceName: string; codename: string }) => {
  const [err, setErr] = useAtom(ErrAtom)

  useEffect(() => {
    if (err) console.error(err.context, err.error)
  }, [err])

  if (!err) return null

  return (
    <Dialog
      isOpen
      title={`Closure${formatProfileName(codename, instanceName)}++ ${err.context}`}
      icon="warning-sign"
      isCloseButtonShown={true}
      onClose={() => setErr(undefined)}
    >
      <DialogBody>{renderError(err)}</DialogBody>
      <DialogFooter
        actions={
          <>
            <Button onClick={() => setErr(undefined)} variant="minimal">
              {/* 晓得了 */}
              {gt.gettext('关闭')}
            </Button>
          </>
        }
      />
    </Dialog>
  )
})

function renderError(err: Err) {
  const friendly = String(err.friendly || err.error?.friendly || '')
  return (
    <>
      {friendly ? <Callout intent="danger">{friendly}</Callout> : null}
      {err.error ? (
        <h4 style={{ marginTop: friendly ? undefined : 0 }} translate="no">
          {err.error.message}
        </h4>
      ) : null}
      <pre style={{ whiteSpace: 'pre-wrap' }}>{navigator.userAgent}</pre>
      {err.error ? <pre style={{ whiteSpace: 'pre-wrap' }}>{err.error.stack}</pre> : null}
    </>
  )
}
