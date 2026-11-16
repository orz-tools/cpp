import { MenuItem } from '@blueprintjs/core'
import { memo } from 'react'
import { gt } from '../../pkg/gt'
import { useChamber } from '../Chamber'
import { ArkntoolsImporterDialog } from './ArkntoolsImporter'
import { MAAItemImporterDialog } from './MAAItemImporter'
import { MAAOperBoxImporterDialog } from './MAAOperBoxImporter'
import { MAAOperProgressImporterDialog } from './MAAOperProgressImporter'
import { SklandImporterDialog } from './SklandImporter'

export const ImporterMenuItems = memo(() => {
  const { add } = useChamber()
  return (
    <>
      <MenuItem icon={'log-in'} text={gt.gettext('导入森空岛数据')} onClick={() => add(SklandImporterDialog)} />
      <MenuItem
        icon={'log-in'}
        text={gt.gettext('导入 MAA「仓库识别」数据')}
        onClick={() => add(MAAItemImporterDialog)}
      />
      <MenuItem
        icon={'log-in'}
        text={gt.gettext('导入 MAA「干员识别」数据')}
        onClick={() => add(MAAOperBoxImporterDialog)}
      />
      <MenuItem
        icon={'log-in'}
        text={gt.gettext('导入 MAA「干员培养」计划')}
        onClick={() => add(MAAOperProgressImporterDialog)}
      />
      <MenuItem
        icon={'log-in'}
        text={gt.gettext('导入明日方舟工具箱「精英材料计算」备份')}
        onClick={() => add(ArkntoolsImporterDialog)}
      />
    </>
  )
})
