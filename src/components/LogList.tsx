import { Icon, IconName, Menu, MenuDivider, MenuItem } from '@blueprintjs/core'
import { useAtom, useAtomValue } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { groupBy, sortBy } from 'ramda'
import React, { memo, useContext, useEffect, useMemo, useState } from 'react'
import useEvent from 'react-use-event-hook'
import { useGameAdapter } from '../Cpp'
import { GameName } from '../games'
import { PSTR, gt, lpstr } from '../pkg/gt'
import { externalLinkProps } from './AboutList'
import { PSTRs } from './LineBreaks'
import { LogTarget, useLogTarget } from './logTargets'
import { usePhoneLayout } from './phoneLayout'
import { CloseSidebarPanelDialogContext } from './SidebarPanelDialog'
import { LogMark, hasUnseenLogs, readLogMark } from './sidebarState'

type LogType = 'new' | 'fix' | 'optimize'

interface LogLine {
  game?: GameName[]
  type: LogType
  desc: PSTR | PSTR[]
}

interface LogDetail extends LogLine {
  target?: LogTarget
}

interface Log extends LogLine {
  date: string
  children?: React.ReactNode
  href?: string
  /** 一条日志底下的细目，悬停时在子菜单里按类型分组列出；计数、分组和未读标记只算这一条 */
  details?: LogDetail[]
}

const arknights = [GameName.Arknights]

const logs: Log[] = [
  {
    date: '2026-11-26',
    type: 'new',
    game: arknights,
    desc: lpstr(() => gt.pgettext('changelog', '公开招募和潜能说明')),
  },
  {
    date: '2026-11-20',
    type: 'new',
    desc: lpstr(() => gt.pgettext('changelog', '「口袋里的罗德岛」更新')),
    details: [
      { type: 'new', desc: lpstr(() => gt.pgettext('changelog', '适配手机')) },
      { type: 'new', desc: lpstr(() => gt.pgettext('changelog', '深色模式')) },
      { game: arknights, type: 'new', desc: lpstr(() => gt.pgettext('changelog', '练度图')), target: 'dataMenu' },
      {
        type: 'new',
        desc: lpstr(() => gt.pgettext('changelog', '多选干员，批量调整顺序、拉满或清空计划')),
        target: 'planView',
      },
      { type: 'new', desc: lpstr(() => gt.pgettext('changelog', '任务右键「完成至此」')) },
      {
        game: arknights,
        type: 'new',
        desc: lpstr(() => gt.pgettext('changelog', '养成成本可折算成蓝材料')),
        target: { view: 'cost.elite2' },
      },
      { type: 'optimize', desc: lpstr(() => gt.pgettext('changelog', '刷图区掉落可显示为图标，合成单独一栏')) },
      { type: 'fix', desc: lpstr(() => gt.pgettext('changelog', '修正部分情况下刷图规划失败或缺漏')) },
    ],
  },
  {
    date: '2026-11-19',
    type: 'new',
    desc: lpstr(() => gt.pgettext('changelog', '「不是人类，而是氛围」大更新')),
    details: [
      { game: arknights, type: 'new', desc: lpstr(() => gt.pgettext('changelog', '干员档案')) },
      {
        game: arknights,
        type: 'new',
        desc: lpstr(() => gt.pgettext('changelog', '关卡效率')),
        target: { panel: 'stages' },
      },
      {
        game: arknights,
        type: 'new',
        desc: lpstr(() => gt.pgettext('changelog', '模组任务')),
        target: { panel: 'moduleMissions' },
      },
      {
        game: arknights,
        type: 'new',
        desc: lpstr(() => gt.pgettext('changelog', '时装')),
        target: { panel: 'skins' },
      },
      {
        game: arknights,
        type: 'new',
        desc: lpstr(() => gt.pgettext('changelog', '养成成本')),
        target: { view: 'cost.elite2' },
      },
      {
        game: arknights,
        type: 'new',
        desc: lpstr(() => gt.pgettext('changelog', '基建技能')),
        target: { view: 'building.locked' },
      },
      {
        game: arknights,
        type: 'new',
        desc: lpstr(() => gt.pgettext('changelog', '模组解锁率')),
        target: { view: 'mod.unlockrate.yituliu' },
      },
      { type: 'new', desc: lpstr(() => gt.pgettext('changelog', '编辑角色过滤器')), target: 'filterEditor' },
      { type: 'new', desc: lpstr(() => gt.pgettext('changelog', '拖动干员、任务调整计划顺序')), target: 'planView' },
      {
        game: arknights,
        type: 'new',
        desc: lpstr(() => gt.pgettext('changelog', '支持更多数据导入')),
        target: 'dataMenu',
      },
      {
        game: arknights,
        type: 'optimize',
        desc: lpstr(() => gt.pgettext('changelog', '物品价值改为本地计算，支持设置')),
        target: 'valueSettings',
      },
      { type: 'optimize', desc: lpstr(() => gt.pgettext('changelog', '更新数据、切换语言和地区无需刷新页面')) },
      { game: arknights, type: 'fix', desc: lpstr(() => gt.pgettext('changelog', '修正部分模组不显示')) },
      { game: arknights, type: 'fix', desc: lpstr(() => gt.pgettext('changelog', '肉鸽干员养成支持')) },
    ],
  },
  {
    date: '2026-05-01',
    type: 'optimize',
    game: [GameName.Arknights],
    desc: lpstr(() => gt.pgettext('changelog', '导入前检查数据更新')),
  },
  {
    date: '2024-10-15',
    type: 'optimize',
    desc: lpstr(() => gt.pgettext('changelog', '支持拼音、模糊匹配')),
  },
  {
    date: '2024-07-19',
    game: [GameName.Arknights],
    type: 'fix',
    desc: lpstr(() => gt.pgettext('changelog', '从 MAA 导入仓库时保留不支持识别的道具')),
  },
  {
    date: '2024-06-25',
    type: 'new',
    desc: lpstr(() => gt.pgettext('changelog', '增加角色的快速过滤器')),
  },
  {
    date: '2024-06-24',
    game: [GameName.Arknights],
    type: 'fix',
    desc: lpstr(() => gt.pgettext('changelog', '修复干员「阿米娅」在特定情况下数据异常的问题')),
  },
  {
    date: '2024-06-15',
    type: 'optimize',
    desc: lpstr(() => gt.pgettext('changelog', '优化小屏幕上的导航栏体验')),
  },
  {
    date: '2024-06-15',
    type: 'fix',
    desc: lpstr(() => gt.pgettext('changelog', '道具图标不存在时显示名称')),
  },
  {
    date: '2024-06-15',
    type: 'new',
    desc: [
      'Add option for UI Languages',
      '支持界面语言切换',
      lpstr(() => gt.pgettext('changelog', '支持界面语言切换')),
    ],
  },
  {
    date: '2024-06-14',
    game: [GameName.Arknights],
    type: 'new',
    desc: lpstr(() => gt.pgettext('changelog', '支持森空岛仓库导入')),
  },
  {
    date: '2024-06-14',
    game: [GameName.Arknights],
    type: 'optimize',
    desc: lpstr(() => gt.pgettext('changelog', '优化干员列表样式')),
  },
  {
    date: '2024-03-21',
    game: [GameName.Arknights],
    type: 'new',
    desc: lpstr(() => gt.pgettext('changelog', '加入海外服务器的游戏数据')),
  },
  {
    date: '2024-01-11',
    game: [GameName.Arknights],
    type: 'new',
    desc: lpstr(() => gt.pgettext('changelog', '增加一些基于社区练度统计数据的排行榜视图')),
    children: <div style={{ padding: 10 }}>请从干员列表右上角的“更多视图”下拉菜单中访问。</div>,
  },
  {
    date: '2024-01-04',
    game: [GameName.Arknights],
    type: 'new',
    desc: lpstr(() => gt.pgettext('changelog', '接入小黑盒 app 的干员统计数据')),
  },
  {
    date: '2023-12-31',
    game: [GameName.Arknights],
    type: 'new',
    desc: lpstr(() => gt.pgettext('changelog', '接入明日方舟一图流的干员练度统计数据')),
  },
  {
    date: '2023-10-09',
    type: 'fix',
    desc: '修复一些线性规划失败的问题',
  },
  {
    date: '2023-10-06',
    type: 'optimize',
    desc: '重写合成清单计算逻辑，对不划算的合成做出警告 (#4)',
    href: 'https://github.com/orz-tools/cpp/issues/4',
  },
  {
    date: '2023-10-06',
    type: 'new',
    desc: '增加“优先培养（星标）”功能',
    children: (
      <div style={{ padding: 10 }}>
        在任务列表中，右键一个任务，
        <br />
        在上下文菜单中选择相应选项，
        <br />
        即可标记为优先培养。
      </div>
    ),
  },
  { date: '2023-10-06', type: 'optimize', desc: '优化更新笔记入口' },
  { date: '2023-08-29', type: 'optimize', desc: '合并导入/导出入口' },
  { date: '2023-08-27', type: 'optimize', desc: '底层组件更新，优化整体性能' },
  { date: '2023-08-27', game: [GameName.Arknights], type: 'new', desc: '增加森空岛数据导入功能' },
  { date: '2023-08-25', type: 'new', desc: '角色头像右键菜单增加资料站链接' },
  { date: '2023-08-25', type: 'optimize', desc: '优化计算性能' },
  { date: '2023-08-25', type: 'fix', desc: '修复一些数字输不进去的问题' },
  { date: '2023-08-18', type: 'optimize', desc: '优化图片资源加载' },
  { date: '2023-08-16', type: 'optimize', desc: '优化列表性能' },
  { date: '2023-07-24', type: 'new', desc: '增加规划目标选择' },
  { date: '2023-07-22', type: 'optimize', desc: '部分数据源迁移至 CDN' },
  { date: '2023-07-22', type: 'optimize', desc: '重新设计数据更新功能' },
  { date: '2023-07-22', type: 'optimize', desc: '优化统一部分 UI/UX' },
  { date: '2023-07-22', type: 'new', desc: '增加用户数据管理（导入/导出）' },
  { date: '2023-07-17', type: 'new', desc: '区分价值“体力”（蓝黑色）和实际体力（蓝色）' },
  { date: '2023-07-09', type: 'new', desc: '刷本规划中增加单次理智和样本数显示' },
  { date: '2023-07-09', game: [GameName.Arknights], type: 'fix', desc: '修复 Firefox 下仓库展示' },
  { date: '2023-07-07', game: [GameName.Arknights], type: 'fix', desc: '适配新解包道具稀有度格式' },
  { date: '2023-07-02', type: 'new', desc: '增加“按游戏内仓库排布形式展示”按钮' },
  { date: '2023-07-01', type: 'optimize', desc: '计算结果中展示暂无可计算来源的材料' },
  { date: '2023-07-01', type: 'fix', desc: '修复重载数据按钮' },
  { date: '2023-06-14', game: [GameName.Arknights], type: 'fix', desc: '修复经验间接计算问题' },
  { date: '2023-06-14', type: 'optimize', desc: '优化分栏顺序' },
  { date: '2023-06-13', type: 'new', desc: '支持一些其他游戏' },
  { date: '2023-06-13', type: 'optimize', desc: '支持多个游戏角色' },
  { date: '2023-06-08', game: [GameName.Arknights], type: 'fix', desc: '换回 Kengxxiao 的数据源 🌚' },
  { date: '2023-05-03', game: [GameName.Arknights], type: 'fix', desc: '换用 yuanyan3060 的数据源' },
  { date: '2023-05-02', game: [GameName.Arknights], type: 'fix', desc: '随便适配一下新数据，但不完全工作' },
  { date: '2023-04-23', type: 'optimize', desc: '以价值排序刷图产物' },
  { date: '2023-04-23', type: 'fix', desc: '任务完成时正确消耗经验道具' },
  { date: '2023-04-23', game: [GameName.Arknights], type: 'fix', desc: '修复复刻的插曲关卡数据' },
]

const iconMap = {
  optimize: 'key-command',
  new: 'star',
  fix: 'build',
} satisfies Record<LogType, IconName>

const typeTitles: Record<LogType, () => string> = {
  new: () => gt.pgettext('changelog type', '新增'),
  optimize: () => gt.pgettext('changelog type', '优化'),
  fix: () => gt.pgettext('changelog type', '修复'),
}

const LogText = memo(({ desc }: { desc: PSTR | PSTR[] }) => (
  <div className="cpp-menu-semi-secondary">
    <PSTRs strings={desc} />
  </div>
))

const LogDetailItem = memo(({ detail }: { detail: LogDetail }) => {
  const open = useLogTarget(detail.target)
  // In 查看更多 the window would cover the panel or list the line leads to
  const closeWindow = useContext(CloseSidebarPanelDialogContext)
  const onClick = useEvent(() => {
    closeWindow?.()
    open?.()
  })
  return (
    <MenuItem
      className={open ? undefined : 'cpp-menu-not-interactive'}
      icon={iconMap[detail.type]}
      text={<LogText desc={detail.desc} />}
      multiline={true}
      onClick={open ? onClick : undefined}
      shouldDismissPopover={!!open}
    />
  )
})

const LogDetails = memo(({ details }: { details: LogDetail[] }) => (
  <>
    {(Object.keys(typeTitles) as LogType[]).map((type) => {
      const lines = details.filter((x) => x.type === type)
      return lines.length ? (
        <React.Fragment key={type}>
          <MenuDivider title={typeTitles[type]()} />
          {lines.map((detail, i) => (
            <LogDetailItem key={i} detail={detail} />
          ))}
        </React.Fragment>
      ) : null
    })}
  </>
))

/** 手机布局里一条日志占满整行，子菜单左右都放不下，弹出来就出了屏幕：点一下在这一条底下展开 */
const InlineLogEntry = ({ log, details }: { log: Log; details: React.ReactNode }) => {
  const [open, setOpen] = useState(false)
  return (
    <>
      <MenuItem
        icon={iconMap[log.type]}
        text={<LogText desc={log.desc} />}
        multiline={true}
        labelElement={<Icon icon={open ? 'chevron-up' : 'chevron-down'} />}
        aria-expanded={open}
        onClick={() => setOpen((x) => !x)}
      />
      {open ? (
        <li role="none">
          <Menu className="cpp-menu-indent">{details}</Menu>
        </li>
      ) : null}
    </>
  )
}

const LogEntry = memo(({ log, inline }: { log: Log; inline: boolean }) => {
  // Blueprint opens a submenu whenever children is not null, so pass nothing for a plain entry
  const submenu =
    log.details || log.children ? (
      <>
        {log.details ? <LogDetails details={log.details} /> : null}
        {log.children}
      </>
    ) : undefined
  if (submenu && inline) return <InlineLogEntry log={log} details={submenu} />
  return (
    <MenuItem
      href={log.href}
      className={submenu || log.href ? undefined : 'cpp-menu-not-interactive'}
      icon={iconMap[log.type]}
      text={<LogText desc={log.desc} />}
      multiline={true}
      popoverProps={{ usePortal: true }}
      submenuProps={log.details ? { className: 'cpp-log-details' } : undefined}
      {...(log.href ? externalLinkProps : {})}
    >
      {submenu}
    </MenuItem>
  )
})

const LogGroup = memo(({ title, items }: { title: React.ReactNode; items: Log[] }) => {
  const inline = usePhoneLayout()
  return (
    <>
      <MenuDivider title={title} />
      {items.map((log, index) => (
        <LogEntry key={index} log={log} inline={inline} />
      ))}
    </>
  )
})

const shownIn =
  (codename: GameName) =>
  (x: LogLine): boolean =>
    x.game ? x.game.includes(codename) : true

function groupLog(codename: GameName) {
  const sortedLogs = sortBy((x) => x.date, logs.slice(0).reverse())
    .reverse()
    .filter(shownIn(codename))
    .map((x) => (x.details ? { ...x, details: x.details.filter(shownIn(codename)) } : x))
    .filter((x) => !x.details || x.details.length > 0)
  return groupBy((x) => x.date, sortedLogs)
}

function latestLogMark(codename: GameName): LogMark | undefined {
  const [latest] = Object.entries(groupLog(codename))
  return latest ? { date: latest[0], count: latest[1]!.length } : undefined
}

const changelogSeenAtom = atomWithStorage<unknown>('cpp_changelog_seen', null, undefined, { getOnInit: true })

function useLatestLogMark() {
  const ga = useGameAdapter()
  return useMemo(() => latestLogMark(ga.getCodename() as GameName), [ga])
}

export function useChangelogBadge() {
  const latest = useLatestLogMark()
  return hasUnseenLogs(latest, readLogMark(useAtomValue(changelogSeenAtom)))
}

export function useMarkChangelogSeen() {
  const latest = useLatestLogMark()
  const [stored, setStored] = useAtom(changelogSeenAtom)
  useEffect(() => {
    const seen = readLogMark(stored)
    if (latest && (seen?.date !== latest.date || seen.count !== latest.count)) setStored(latest)
  }, [latest, stored, setStored])
}

export const FullLogList = memo(() => {
  const ga = useGameAdapter()
  const groupedLogs = useMemo(() => groupLog(ga.getCodename() as GameName), [ga])
  return (
    <>
      {Object.entries(groupedLogs).map(([k, v]) => {
        return <LogGroup key={k} title={k} items={v!} />
      })}
    </>
  )
})

export const SimpleLogList = memo(({ onMore }: { onMore: () => void }) => {
  const ga = useGameAdapter()
  const groupedLogs = useMemo(() => Object.entries(groupLog(ga.getCodename() as GameName)), [ga])

  return (
    <>
      <LogGroup
        title={
          <>
            <span style={{ float: 'right', fontWeight: 'normal' }}>
              {gt
                .gettext('截止 %s') /* I10N: %s: datetime */
                .replaceAll('%s', groupedLogs[0][0])}
            </span>
            {gt.gettext('近期更新')}
          </>
        }
        items={groupedLogs
          .map((x) => x[1]!)
          .flat(1)
          .slice(
            0,
            Math.max(
              5,
              groupedLogs.slice(0, 3).reduce((acc, cur) => acc + cur[1]!.length, 0),
            ),
          )}
      />
      <MenuItem icon="double-chevron-right" text={gt.gettext('查看更多…')} onClick={onMore} />
    </>
  )
})
