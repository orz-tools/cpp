import { useAtomValue, useSetAtom } from 'jotai'
import useEvent from 'react-use-event-hook'
import { useCpp } from '../Cpp'
import { UpdateResult } from '../pkg/cpp-basic'
import { gt } from '../pkg/gt'
import { ErrAtom } from './Err'
import { AppToaster } from './Toaster'

/** 顶栏的「检查数据更新」和它右键的「重载数据」，手机「更多」里的两行也用它 */
export function useReloadGameData() {
  const cpp = useCpp()
  const dm = cpp.gameAdapter.getDataManager()
  const { updating } = useAtomValue(cpp.gameDataStatusAtom)
  const setError = useSetAtom(ErrAtom)
  const run = useEvent(async (operation: () => Promise<UpdateResult>) => {
    const toaster = await AppToaster
    const reload = toaster.show(
      { message: gt.gettext('更新数据中…'), isCloseButtonShown: false, timeout: 0, intent: 'primary' },
      'reload',
    )
    try {
      const r = await operation()
      if (r.failed.length > 0) {
        // What did load is committed already; the error says what did not.
        toaster.dismiss(reload)
        setError({ error: r.failed[0], context: gt.pgettext('error context', '检查数据更新失败') })
        return
      }
      // Replaced in place: a dismiss followed by a show with the same key drops both, as the dismiss lands last.
      if (r.applied) {
        toaster.show({ message: gt.gettext('游戏数据已更新'), intent: 'success' }, reload)
      } else {
        toaster.show({ message: gt.gettext('未找到新数据') }, reload)
      }
    } catch (e) {
      console.log(e)
      toaster.dismiss(reload)
      setError({ error: e, context: gt.pgettext('error context', '检查数据更新失败') })
    }
  })
  const checkForUpdates = useEvent(() => void run(() => dm.update({ force: true })))
  const reload = useEvent(() => void run(() => dm.reset()))
  return { updating, checkForUpdates, reload }
}
