import { Alignment, Button, Classes, Menu, MenuDivider, MenuItem, Navbar, Spinner, Tag } from '@blueprintjs/core'
import { Popover2 } from '@blueprintjs/popover2'
import { useAtomValue, useSetAtom } from 'jotai'
import React, { ErrorInfo, useEffect, useMemo, useState } from 'react'
import './App.css'
import { useAtoms, useCpp, useGameAdapter } from './Cpp'
import { AboutList } from './components/AboutList'
import { CharacterList } from './components/CharacterList'
import { ConfigButton, StageButton } from './components/ConfigUi'
import { FarmList } from './components/FarmList'
import { ItemList } from './components/ItemList'
import { LogList } from './components/LogList'
import { SynthesisList } from './components/SynthesisList'
import { TaskList } from './components/TaskList'
import { ValueOptionButton } from './components/Value'
import { useRequest } from './hooks/useRequest'
import { formatProfileName, getProfiles } from './profiles'

function UndoButtons() {
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
        text="Redo"
        minimal={true}
        onClick={() => setData('redo')}
        rightIcon={redoCounter > 0 ? <Tag round={true}>{redoCounter}</Tag> : undefined}
      />
    </>
  )
}

function ReloadDataButton() {
  const ga = useGameAdapter()
  const dm = ga.getDataManager()
  const { loading, send } = useRequest(async () => {
    await dm.refresh()
    location.reload()
  })

  return (
    <>
      <Button icon="refresh" disabled={loading} text="重载数据" minimal={true} onClick={() => send()} />
    </>
  )
}

function ProfileMenu() {
  const profiles = useMemo(() => getProfiles().filter((x) => !x[2]), [])
  const cpp = useCpp()
  return (
    <>
      {profiles.map((profile) => (
        <MenuItem
          key={profile[0] + '/' + profile[1]}
          href={`/${encodeURIComponent(profile[0])}/${encodeURIComponent(profile[1])}`}
          text={<code>{formatProfileName(profile[0], profile[1])}</code>}
          active={profile[0] === cpp.gameAdapter.getCodename() && profile[1] === cpp.instanceName}
        />
      ))}
      <MenuDivider />
      <MenuItem text="Home" icon="home" href="/" />
    </>
  )
}

function App() {
  const cpp = useCpp()
  const defaultCharStatusWidth = 43 * 6
  const charStatusWidth = cpp.gameComponent.charStatusWidth || defaultCharStatusWidth
  const ga = useGameAdapter()
  return (
    <>
      {cpp.gameComponent.style ? <style dangerouslySetInnerHTML={{ __html: cpp.gameComponent.style }} /> : null}
      <Navbar fixedToTop={true}>
        <Navbar.Group align={Alignment.LEFT}>
          <Navbar.Heading style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
            <img src="/favicon.png" alt="Closure++ logo" width="24" height="24" title="" style={{ marginRight: 4 }} />
            <code>{`Closure`}</code>
            <Popover2
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
            </Popover2>
            <code>{`++`}</code>
            {/* <code>{`Closure++`}</code> */}
          </Navbar.Heading>
          <Navbar.Divider />
          <UndoButtons />
          <Navbar.Divider />
          <ValueOptionButton />
          <StageButton />
          <ConfigButton />
        </Navbar.Group>
        <Navbar.Group align={Alignment.RIGHT}>
          <ReloadDataButton />
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
            width: '300px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <LogList />
        </section>
        <section
          className={Classes.ELEVATION_1}
          style={{
            width: Math.max(730 - defaultCharStatusWidth * 2 + charStatusWidth * 2, 560),
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <CharacterList />
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
            width: '250px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <FarmList />
        </section>
        <section
          className={Classes.ELEVATION_1}
          style={{
            width: '220px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <SynthesisList />
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
}

function SuperAppWrapper() {
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
    return (
      <>
        <Spinner size={200} />
        <ReloadDataButton />
      </>
    )
  }

  return <App />
}

export function AppWrapper() {
  return (
    <ErrorBoundary>
      <SuperAppWrapper />
    </ErrorBoundary>
  )
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error?: Error }> {
  public constructor(props: { children: React.ReactNode }) {
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
        <>
          <h1>Oops!</h1>

          <Navbar>
            <Navbar.Group align={Alignment.LEFT}>
              您不妨试试
              <ReloadDataButton />
            </Navbar.Group>
          </Navbar>

          {this.state.error ? <pre>{this.state.error.message}</pre> : null}
          {this.state.error ? <pre>{this.state.error.stack}</pre> : null}
        </>
      )
    }

    return this.props.children
  }
}
