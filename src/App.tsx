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
import React, { ErrorInfo, memo, useEffect, useMemo, useState } from 'react'
import './App.css'
import { useAtoms, useCpp, useGameAdapter } from './Cpp'
import { AboutList, HelpButton } from './components/AboutList'
import { Chamber, ChamberPortal } from './components/Chamber'
import { CharacterList } from './components/CharacterList'
import { ConfigButton, MaybeSoulButton, RegionButton, StageButton } from './components/ConfigUi'
import { Err, ErrAtom } from './components/Err'
import { FarmList } from './components/FarmList'
import { ItemList } from './components/ItemList'
import { TaskList } from './components/TaskList'
import { AppToaster } from './components/Toaster'
import { UserDataManagerButton, UserDataManagerMenuItem } from './components/UserDataManager'
import { ValueOptionButton } from './components/Value'
import { useComponents } from './hooks/useComponents'
import { useRequest } from './hooks/useRequest'
import { LocaleButton } from './locales'
import { gt } from './pkg/gt'
import { formatProfileName, getProfiles } from './profiles'

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
        text="Undo"
        minimal={true}
        onClick={() => setData('undo')}
        rightIcon={undoCounter > 0 ? <Tag round={true}>{undoCounter}</Tag> : undefined}
      />
      <Button
        icon="redo"
        disabled={redoCounter === 0}
        text=""
        minimal={true}
        onClick={() => setData('redo')}
        rightIcon={redoCounter > 0 ? <Tag round={true}>{redoCounter}</Tag> : undefined}
      />
    </>
  )
})

const ReloadDataButton = memo(() => {
  const ga = useGameAdapter()
  const dm = ga.getDataManager()
  const setError = useSetAtom(ErrAtom)
  const { loading, send } = useRequest(async () => {
    const reload = AppToaster.show(
      { message: gt.gettext('更新数据中…'), isCloseButtonShown: false, timeout: 0, intent: 'primary' },
      'reload',
    )
    try {
      const r = await dm.refresh()
      AppToaster.dismiss(reload)
      if (r) {
        AppToaster.show({ message: gt.gettext('数据已更新，正在重新载入…'), intent: 'success' }, reload)
        location.reload()
      } else {
        AppToaster.show({ message: gt.gettext('未找到新数据') }, reload)
      }
    } catch (e) {
      console.log(e)
      AppToaster.dismiss(reload)
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
              onClick={async () => {
                await dm.reset()
                location.reload()
              }}
            />
          </Menu>
        }
      >
        <Button
          icon="refresh"
          disabled={loading}
          text={gt.gettext('检查数据更新')}
          minimal={true}
          onClick={() => send()}
        />
      </ContextMenu>
    </>
  )
})

const ProfileMenu = memo(() => {
  const profiles = useMemo(() => getProfiles().filter((x) => !x[2]), [])
  const cpp = useCpp()
  return (
    <>
      {profiles.map((profile) => (
        <MenuItem
          key={profile[0] + '/' + profile[1]}
          href={`/${encodeURIComponent(profile[0])}/${encodeURIComponent(profile[1])}`}
          text={<code>{formatProfileName(profile[0], profile[1])}</code>}
          active={profile[0].toString() === cpp.gameAdapter.getCodename() && profile[1] === cpp.instanceName}
        />
      ))}
      <MenuDivider />
      <MenuItem text="Home" icon="home" href="/" />
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
        <Button minimal style={{ paddingLeft: 0, paddingRight: 0 }}>
          <code>
            [{ga.getCodename().toUpperCase()}][{JSON.stringify(cpp.instanceName)}]
          </code>
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
  const ga = useGameAdapter()

  useEffect(() => {
    void (async () => {
      const result = await ga.getDataManager().checkUpdates()
      if (result)
        AppToaster.show(
          {
            message: gt.gettext('数据已更新，请重新载入页面'),
            intent: 'success',
            action: {
              text: gt.gettext('重新载入'),
              icon: 'refresh',
              onClick: () => location.reload(),
            },
          },
          'auto-update',
        )
    })()
  }, [ga])

  return (
    <>
      {cpp.gameComponent.style ? <style dangerouslySetInnerHTML={{ __html: cpp.gameComponent.style }} /> : null}
      <Navbar fixedToTop={true}>
        <Navbar.Group align={Alignment.LEFT}>
          <ClosureButtonHeading />
          <Navbar.Divider />
          <UndoButtons />
          <Navbar.Divider />
          <ValueOptionButton />
          <StageButton />
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
        <section
          className={Classes.ELEVATION_1}
          style={{
            width: '300px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <AboutList />
        </section>
        <section
          className={Classes.ELEVATION_1}
          style={{
            width: Math.max(730 - defaultCharStatusWidth * 2 + charStatusWidth * 2 + charExtraWidth, 560),
            display: 'flex',
            flexDirection: 'column',
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
    </>
  )
})

const DataMenu = memo(() => {
  const { ImporterMenuItems, ExporterMenuItems } = useComponents()
  return (
    <Menu>
      <UserDataManagerMenuItem />
      {ImporterMenuItems ? <MenuDivider /> : null}
      {ImporterMenuItems ? <ImporterMenuItems /> : null}
      {ExporterMenuItems ? <MenuDivider /> : null}
      {ExporterMenuItems ? <ExporterMenuItems /> : null}
    </Menu>
  )
})

const DataDropdown = memo(() => {
  return (
    <Popover usePortal={true} minimal={true} content={<DataMenu />} position="bottom-right">
      <Button icon={'th-derived'} minimal={true} rightIcon={'chevron-down'}>
        {gt.gettext('导入/导出')}
      </Button>
    </Popover>
  )
})

const SuperAppWrapper = memo(() => {
  const ga = useGameAdapter()
  const dm = ga.getDataManager()
  const [, setTicker] = useState(0)
  useEffect(() => {
    let timer: null | ReturnType<typeof setInterval> = setInterval(() => {
      if (dm.error || dm.initialized) {
        clearTimeout(timer!)
        timer = null
        setTicker((x) => x + 1)
      }
    }, 100)
    return () => void (timer && clearTimeout(timer))
  }, [dm])

  if (dm.error) throw dm.error

  if (!dm.initialized) {
    return <Loading />
  }

  return <App />
})

export const Loading = memo(() => {
  const ga = useGameAdapter()
  const dm = ga.getDataManager()
  const [, setTicker] = useState(0)
  const [status, setStatus] = useState(gt.pgettext('loading status', '别急…') /* I10N: initial */)
  useEffect(() => {
    let timer: null | ReturnType<typeof setInterval> = setInterval(() => {
      if (dm.loading.size > 0) {
        setStatus(
          gt
            .pgettext(
              'loading status',
              `仍在加载 %s 中…`,
            ) /* I10N: loading data objects, %s: names of pending data objects */
            .replaceAll('%s', [...dm.loading].join(', ')),
        )
      } else {
        setStatus(gt.pgettext('loading status', '收拾中…') /* I10N: loaded data objects */)
      }

      if (dm.error || dm.initialized) {
        setStatus(gt.pgettext('loading status', '马上就好…') /* I10N: done */)
        clearTimeout(timer!)
        timer = null
        setTicker((x) => x + 1)
      }
    }, 100)
    return () => void (timer && clearTimeout(timer))
  }, [dm])

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
          <DialogBody>{renderError({ error: this.state.error! })}</DialogBody>
          <DialogFooter
            actions={
              <>
                <AnchorButton href={'/'} minimal icon={'home'}>
                  {gt.gettext('返回主页')}
                </AnchorButton>
              </>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'row' }}>
              <Button minimal disabled>
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
            <Button onClick={() => setErr(undefined)} minimal>
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
      {err.error ? <h4 style={{ marginTop: friendly ? undefined : 0 }}>{err.error.message}</h4> : null}
      <pre style={{ whiteSpace: 'pre-wrap' }}>{navigator.userAgent}</pre>
      {err.error ? <pre style={{ whiteSpace: 'pre-wrap' }}>{err.error.stack}</pre> : null}
    </>
  )
}
