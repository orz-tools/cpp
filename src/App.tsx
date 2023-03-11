import { Alignment, Button, Classes, Navbar, Spinner, Tag } from '@blueprintjs/core'
import { useAtomValue, useSetAtom } from 'jotai'
import { useEffect, useState } from 'react'
import './App.css'
import { CharacterList } from './components/CharacterList'
import { useInject } from './hooks/useContainer'
import { DataManager } from './pkg/cpp-core/DataManager'
import { UserDataAtomHolder } from './pkg/cpp-core/UserData'

const NAVBAR_HEIGHT = '50px'
const SIDEBAR_WIDTH = '800px'

function UndoButtons() {
  const atoms = useInject(UserDataAtomHolder)
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

function App() {
  return (
    <div className="App">
      <Navbar fixedToTop={true}>
        <Navbar.Group align={Alignment.LEFT}>
          <Navbar.Heading>Closure++</Navbar.Heading>
          <Navbar.Divider />
          <UndoButtons />
          <Navbar.Divider />
        </Navbar.Group>
      </Navbar>
      <section
        className={Classes.ELEVATION_1}
        style={{
          left: 0,
          bottom: 0,
          top: NAVBAR_HEIGHT,
          width: SIDEBAR_WIDTH,
          position: 'fixed',
          overflowY: 'auto',
          overflowX: 'visible',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <CharacterList />
      </section>
      <section style={{ marginLeft: SIDEBAR_WIDTH, paddingTop: NAVBAR_HEIGHT }}>'Source Han Sans SC'</section>
    </div>
  )
}

export function AppWrapper() {
  const dm = useInject(DataManager)
  const [, setTicker] = useState(0)
  useEffect(() => {
    let timer: null | ReturnType<typeof setInterval> = setInterval(() => {
      if (dm.initialized) {
        clearTimeout(timer!)
        timer = null
        setTicker((x) => x + 1)
      }
    }, 100)
    return () => void (timer && clearTimeout(timer!))
  }, [dm])

  if (!dm.initialized) {
    return <Spinner size={200} />
  }

  return <App />
}
