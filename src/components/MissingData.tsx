import { Button, NonIdealState } from '@blueprintjs/core'
import { useAtomValue } from 'jotai'
import { memo } from 'react'
import useEvent from 'react-use-event-hook'
import { useCpp } from '../Cpp'
import { DataContainerObject } from '../pkg/dccache'
import { gt } from '../pkg/gt'
import { networkAdvice } from './Err'

/**
 * Whether the committed game data goes without this optional container, whether it is loading, and a retry that loads
 * every missing one again.
 */
export function useMissingData(obj: DataContainerObject<any> | null | undefined) {
  const cpp = useCpp()
  const status = useAtomValue(cpp.gameDataStatusAtom)
  const missing = !!obj && status.missing.includes(obj.name)
  const loading = !!obj && status.loading.includes(obj.name)
  const retry = useEvent(() => {
    // The place that offers 重试 keeps saying it did not load; that is the feedback, as for the (i) panel.
    void cpp.gameAdapter
      .getDataManager()
      .loadMissing()
      .then(
        (r) => r.failed.forEach((e) => console.error('Failed to load', e)),
        (e) => console.error('Failed to load the missing game data', e),
      )
  })
  return { missing, loading, retry }
}

/** Fills the place of what cannot be drawn without the container, with the network advice and a 重试 */
export const MissingDataState = memo(
  ({ obj, title, description }: { obj: DataContainerObject<any>; title: string; description: string }) => {
    const { loading, retry } = useMissingData(obj)
    return (
      <NonIdealState
        icon="warning-sign"
        title={title}
        description={
          <>
            {description}
            <br />
            {networkAdvice()}
          </>
        }
        action={<Button icon="refresh" text={gt.pgettext('missing data', '重试')} loading={loading} onClick={retry} />}
      />
    )
  },
)
