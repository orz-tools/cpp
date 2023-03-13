import { Alignment, Button, Classes, Navbar, Spinner, Tag } from '@blueprintjs/core'
import { useAtomValue, useSetAtom } from 'jotai'
import { useEffect, useState } from 'react'
import './App.css'
import { AboutList } from './components/AboutList'
import { CharacterList } from './components/CharacterList'
import { ItemList } from './components/ItemList'
import { TaskList } from './components/TaskList'
import { useInject } from './hooks/useContainer'
import { DataManager } from './pkg/cpp-core/DataManager'
import { UserDataAtomHolder } from './pkg/cpp-core/UserData'

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
    <>
      <Navbar fixedToTop={true}>
        <Navbar.Group align={Alignment.LEFT}>
          <Navbar.Heading>Closure++</Navbar.Heading>
          <Navbar.Divider />
          <UndoButtons />
          <Navbar.Divider />
        </Navbar.Group>
      </Navbar>
      <div className="App">
        <section
          className={Classes.ELEVATION_1}
          style={{
            width: '750px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <CharacterList />
        </section>
        <section
          className={Classes.ELEVATION_1}
          style={{
            width: '580px',
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
            width: '350px',
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
