import { FocusStyleManager } from '@blueprintjs/core'
import { Provider } from 'jotai'
// import { DevTools } from 'jotai-devtools'
import { atomWithStorage } from 'jotai/utils'
import ReactDOM from 'react-dom/client'
import { AppWrapper } from './App'
import { ContainerContext } from './hooks/useContainer'
import './index.css'
import { Container } from './pkg/container'
import { DataManager } from './pkg/cpp-core/DataManager'
import { UserData, UserDataAtomHolder } from './pkg/cpp-core/UserData'
import { Store } from './Store'

const container = new Container()
void container.get(DataManager).init()

const atoms = container.get(UserDataAtomHolder)
atoms.setAtom(atomWithStorage<UserData | undefined>('cpp_userdata', undefined))

const store = container.get(Store).store
store.sub(atoms.undoCounterAtom, () => {
  console.log('undo counter changed', store.get(atoms.undoCounterAtom))
})
store.sub(atoms.dataAtom, () => {})

Object.assign(globalThis, {
  $dm: container.get(DataManager),
  $store: store,
  $atoms: atoms,
})

FocusStyleManager.onlyShowFocusOnTabs()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  // <React.StrictMode>
  <Provider store={store}>
    {/* <DevTools store={store} /> */}
    <ContainerContext.Provider value={container}>
      <AppWrapper />
    </ContainerContext.Provider>
  </Provider>,
  // </React.StrictMode>,
)
