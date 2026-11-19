import { useGameAdapter } from '../../Cpp'
import { Arknights, ArknightsAdapter } from '../../pkg/cpp-arknights'
import { gt } from '../../pkg/gt'
import { MissingDataState, useMissingData } from '../MissingData'

/**
 * A hook: while the penguin matrix is missing there are no stages, so what plans or lists them shows this in their place;
 * null once it is there.
 */
export function useDropDataNotice(): React.ReactNode {
  const dm = (useGameAdapter<Arknights>() as ArknightsAdapter).getDataManager()
  const { missing } = useMissingData(dm.$penguin)
  if (!missing) return null
  return (
    <MissingDataState
      obj={dm.$penguin}
      title={gt.pgettext('missing data', '物品价值、关卡统计不可用')}
      description={gt.pgettext('missing data', '企鹅物流的掉落数据载入失败。')}
    />
  )
}
