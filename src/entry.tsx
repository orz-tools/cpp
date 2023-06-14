import { Provider } from 'jotai'
import ReactDOM from 'react-dom/client'
import { AppWrapper } from './App'
import { Cpp, CppContext } from './Cpp'
import { IGameComponent } from './components/types'
import './index.css'
import { IGameAdapter } from './pkg/cpp-basic'

export function runCpp(
  storagePrefix: string,
  instanceName: string,
  gameAdapter: IGameAdapter<any>,
  gameComponent: IGameComponent,
) {
  const cpp = new Cpp(storagePrefix, instanceName, gameAdapter, gameComponent)
  void cpp.gameAdapter.getDataManager().init()

  Object.assign(globalThis, {
    $cpp: cpp,
    $dm: cpp.gameAdapter.getDataManager(),
    $ga: cpp.gameAdapter,
    $store: cpp.store,
    $atoms: cpp.atoms,
  })

  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    // <React.StrictMode>
    <Provider store={cpp.store}>
      <CppContext.Provider value={cpp}>
        <AppWrapper />
      </CppContext.Provider>
    </Provider>,
    // </React.StrictMode>,
  )
}
