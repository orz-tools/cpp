import { Provider } from 'jotai'
import ReactDOM from 'react-dom/client'
import { AppWrapper } from './App'
import { Cpp, CppContext } from './Cpp'
import { Err, ErrAtom } from './components/Err'
import { IGameComponent } from './components/types'
import './index.css'
import { IGame, IGameAdapter } from './pkg/cpp-basic'

export function runCpp(
  storagePrefix: string,
  instanceName: string,
  gameAdapter: IGameAdapter<IGame>,
  gameComponent: IGameComponent,
) {
  const cpp = new Cpp(storagePrefix, instanceName, gameAdapter, gameComponent)
  void (async () => {
    const result = await environmentCheck()
    if (result) return cpp.store.set(ErrAtom, Object.assign({ context: '环境检测失败' }, result))

    await cpp.gameAdapter.getDataManager().init(cpp.region)
  })().catch((e) => {
    cpp.store.set(ErrAtom, { error: e, context: '初始化失败' })
  })

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

async function environmentCheck(): Promise<Err | null> {
  try {
    if (!Object.entries) throw new Error('Object.entries is not defined')
    if (!Object.fromEntries) throw new Error('Object.fromEntries is not defined')
    if (!Object.hasOwn) throw new Error('Object.hasOwn is not defined')
  } catch (e) {
    return { error: e, friendly: '请更新您的浏览器。' }
  }
  await Promise.resolve()
  return null
}
