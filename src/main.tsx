import { FocusStyleManager } from '@blueprintjs/core'
import { Provider } from 'jotai'
import ReactDOM from 'react-dom/client'
import { AppWrapper } from './App'
import { Cpp, CppContext } from './Cpp'
import './index.css'
import { ArknightsAdapter } from './pkg/cpp-arknights/GameAdapter'

const storagePrefix = 'cpp_'
const cpp = new Cpp(storagePrefix, '', new ArknightsAdapter())
void cpp.gameAdapter.getDataManager().init()

Object.assign(globalThis, {
  $cpp: cpp,
  $dm: cpp.gameAdapter.getDataManager(),
  $ga: cpp.gameAdapter,
  $store: cpp.store,
  $atoms: cpp.atoms,
})

FocusStyleManager.onlyShowFocusOnTabs()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  // <React.StrictMode>
  <Provider store={cpp.store}>
    <CppContext.Provider value={cpp}>
      <AppWrapper />
    </CppContext.Provider>
  </Provider>,
  // </React.StrictMode>,
)
