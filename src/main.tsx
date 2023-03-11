import React from 'react'
import ReactDOM from 'react-dom/client'
import { AppWrapper } from './App'
import { ContainerContext } from './hooks/useContainer'
import './index.css'
import { Container } from './pkg/container'
import { DataManager } from './pkg/cpp-core/DataManager'
import { newUserData, UserDataAtomHolder } from './pkg/cpp-core/UserData'
import { atomWithStorage } from 'jotai/utils'
import { Store } from './Store'
import { Provider } from 'jotai'

const container = new Container()
void container.get(DataManager).init()

const atoms = container.get(UserDataAtomHolder)
atoms.setAtom(atomWithStorage('cpp_userdata', newUserData()))

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

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  // <React.StrictMode>
  <Provider store={store}>
    <ContainerContext.Provider value={container}>
      <AppWrapper />
    </ContainerContext.Provider>
  </Provider>,
  // </React.StrictMode>,
)
