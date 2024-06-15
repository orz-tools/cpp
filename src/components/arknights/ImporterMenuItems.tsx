import { MenuItem } from '@blueprintjs/core'
import { memo } from 'react'
import { gt } from '../../pkg/gt'
import { useChamber } from '../Chamber'
import { MAAItemImporterDialog } from './MAAItemImporter'
import { SklandImporterDialog } from './SklandImporter'

export const ImporterMenuItems = memo(() => {
  const { add } = useChamber()
  return (
    <>
      <MenuItem icon={'log-in'} text={gt.gettext('导入「森空岛」数据')} onClick={() => add(SklandImporterDialog)} />
      <MenuItem
        icon={'log-in'}
        text={gt.gettext('导入「MAA 仓库识别」数据')}
        onClick={() => add(MAAItemImporterDialog)}
      />
    </>
  )
})
