import { Alignment, Button, Classes, Navbar, Spinner, Tag } from '@blueprintjs/core'
import { useAtomValue, useSetAtom } from 'jotai'
import React, { ErrorInfo, useEffect, useState } from 'react'
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

function App() {
  const cpp = useCpp()
  const ga = useGameAdapter()
  return (
    <>
      <Navbar fixedToTop={true}>
        <Navbar.Group align={Alignment.LEFT}>
          <Navbar.Heading style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
            <img src="/favicon.png" alt="Closure++ logo" width="24" height="24" title="" style={{ marginRight: 4 }} />
            <code>{`Closure`}</code>
            <Button minimal style={{ paddingLeft: 0, paddingRight: 0 }}>
              <code>
                [{ga.getCodename().toUpperCase()}][{JSON.stringify(cpp.instanceName)}]
              </code>
            </Button>
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
          <LogList />
        </section>
        <section
          className={Classes.ELEVATION_1}
          style={{
            width: '730px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <CharacterList />
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
            width: '300px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <AboutList />
        </section>
        <section></section>
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
    return () => void (timer && clearTimeout(timer!))
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
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('error occurred!', error, errorInfo)
  }

  render() {
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
