import { IconName } from '@blueprintjs/core'
import React from 'react'
import { BlobFlavour } from '../pkg/blobcache'
import { FieldContext, ICharacter, IGameAdapter, Querier } from '../pkg/cpp-basic'
import { PSTR } from '../pkg/gt'
import type { ImportFormat } from './Importer'

export interface ItemSimulatedViewConfig {
  limit: number
  horizontal: boolean
  viewMaxSize: number
}

export interface SidebarPanel {
  /** 记在 cpp_sidebar 里，所以发布之后不能改 */
  id: string
  icon: IconName
  /** 图标下面的短名 */
  label: PSTR
  /** 标题栏和大窗口的标题 */
  title: PSTR
  Body: React.FC
  /** 画在标题栏右边、「弹出」前面的控件 */
  Toolbar?: React.FC
  /** 大窗口的内容；没有时标题栏不显示「弹出」 */
  Wide?: React.FC
  /** 返回 false 时不画图标，例如面板要的数据 worker 还没发布 */
  isAvailable?: (ga: IGameAdapter<any>) => boolean
  /** hook：返回 true 时图标上亮红点 */
  useBadge?: () => boolean
}

export interface IGameComponent {
  email?: string
  AboutCopyright?: React.FC
  AboutThirdParty?: React.FC
  AboutCredits?: React.FC
  AboutDataSources?: React.FC
  CharacterContextMenuItems?: React.FC<{ character: ICharacter }>
  CharacterStatusPopover?: React.FC<{ character: any; isGoal: boolean }>
  renderCharacterStatus?: (status: any, character: any, current?: any, alreadyHide?: boolean) => any
  renderCharacterAvatarBadge?: (status: any, character: any) => any
  charStatusWidth?: number
  style?: string
  itemSimulatedViewConfig?: ItemSimulatedViewConfig
  blobFlavours?: BlobFlavour[]
  ImporterMenuItems?: React.FC
  ExporterMenuItems?: React.FC
  ConfigMenuItems?: React.FC
  /** A hook: the formats the import paste box tries after Closure++'s own, in order */
  useImportFormats?: () => ImportFormat[]
  extraFields?: Record<
    string,
    {
      /** 默认宽度；过滤器可以改，所以 C 按传入的 width 画 */
      width: number
      C: React.FC<{ query: Querier<any, any>; context: FieldContext<any, any, any>; width: number }>
    }
  >
  TaskDisplay?: React.FC<{ type: any; charId: string; formattedString: string }>
  QuickFilterBuilder?: React.FC
  ValueConfigMenu?: React.FC
  quickFilters?: Record<string, string>
  /** 排在外壳自己的「关于」后面，按数组顺序 */
  sidebarPanels?: SidebarPanel[]
}
