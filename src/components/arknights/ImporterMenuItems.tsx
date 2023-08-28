import { MenuItem } from '@blueprintjs/core'
import { memo } from 'react'
import { useChamber } from '../Chamber'
import { MAAItemImporterDialog } from './MAAItemImporter'
import { SklandImporterDialog } from './SklandImporter'

export const ImporterMenuItems = memo(() => {
  const { add } = useChamber()
  return (
    <>
      <MenuItem icon={'log-in'} text="导入「森空岛」数据" onClick={() => add(SklandImporterDialog)} />
      <MenuItem icon={'log-in'} text="导入「MAA 仓库识别」数据" onClick={() => add(MAAItemImporterDialog)} />
      {/* <MenuItem icon={'log-in'} text="导入「明日方舟工具箱」数据" onClick={() => add(ItemImporterDialog)} /> */}
      {/* <MenuItem icon={'log-in'} text="导入「企鹅物流刷图规划」数据" onClick={() => add(ItemImporterDialog)} /> */}
    </>
  )
})
