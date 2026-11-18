import { IconName } from '@blueprintjs/core'
import React from 'react'
import { BlobFlavour } from '../pkg/blobcache'
import { FieldContext, ICharacter, IGameAdapter, Querier, Task } from '../pkg/cpp-basic'
import { PSTR } from '../pkg/gt'
import type { ImportFormat } from './Importer'
import type { PeekKind } from './peek'

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

export interface DossierSection {
  /** 页签的 id；选中的页签记在 cpp_dossier 里，所以发布之后不能改 */
  id: string
  /** 页签上的字 */
  title: PSTR
  Body: React.FC<{ character: ICharacter }>
  /** 返回 false 时这一页不出现，例如这个干员没有模组，或者数据 worker 还没发布 */
  isAvailable?: (ga: IGameAdapter<any>, character: ICharacter) => boolean
  /** hook：页签标题后面的小标记，例如「0/4」；返回 null 时不画 */
  useTag?: (character: ICharacter) => string | null
}

/** 任务列表里任务名下面的一行 */
export interface TaskNote {
  /** 同一条任务里唯一 */
  key: string
  icon: IconName
  text: string
  /** 悬停显示 */
  title?: string
  /** 点了打开这名干员的档案，翻到 section 这一页，并请求框选 frame（focusFrame.ts 的 target） */
  dossier?: { section: string; frame: string }
}

export interface IGameComponent {
  email?: string
  AboutCopyright?: React.FC
  AboutThirdParty?: React.FC
  AboutCredits?: React.FC
  AboutDataSources?: React.FC
  CharacterContextMenuItems?: React.FC<{ character: ICharacter }>
  CharacterStatusPopover?: React.FC<{
    character: any
    isGoal: boolean
    embedded?: boolean
    /** 给了时，编辑器在原来写「当前状态」「培养目标」的地方画切换条，切换时回调；不给时照旧只写模式名 */
    onModeChange?: (isGoal: boolean) => void
  }>
  /** 档案标题里外文名后面的补充信息 */
  CharacterDossierMeta?: React.FC<{ character: any }>
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
      /** 列头说明的正文，标题是列名；给了时列名画成虚线下划线，悬停或聚焦时出说明 */
      Tip?: React.ComponentType
    }
  >
  TaskDisplay?: React.FC<{ type: any; charId: string; formattedString: string }>
  /** join 是当前查询展开的子查询，按它画这一组的按钮 */
  QuickFilterBuilder?: React.FC<{ join?: string }>
  ValueConfigMenu?: React.FC
  /** 快捷过滤的字段 → 比较符 */
  quickFilters?: Record<string, string>
  /** 展开了这里列出的子查询时用它的那一组，代替 quickFilters */
  quickFiltersByJoin?: Record<string, Record<string, string>>
  /** 排在外壳自己的「关于」后面，按数组顺序 */
  sidebarPanels?: SidebarPanel[]
  /** 排在外壳自己的「练度」后面，按数组顺序 */
  dossierSections?: DossierSection[]
  /** 点了弹出的卡片，按 PeekRef 的 kind；通用部分自带 item，没登记的种类原样画、不能点 */
  peekKinds?: Record<string, PeekKind>
  /** 任务列表在任务名下面、材料前面加的说明行；没有时返回空数组。纯函数，任务列表算行高时也调用 */
  taskNotes?: (ga: IGameAdapter<any>, task: Task<any>) => TaskNote[]
}
