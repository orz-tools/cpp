import { Drawer, IconName, Menu, MenuDivider, MenuItem } from '@blueprintjs/core'
import { groupBy, sortBy } from 'ramda'
import React, { memo, useMemo } from 'react'
import { useGameAdapter } from '../Cpp'
import { GameName } from '../games'
import { PSTR, gt, lpstr } from '../pkg/gt'
import { externalLinkProps } from './AboutList'
import { useChamber } from './Chamber'
import { PSTRs } from './LineBreaks'

const logs = [
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
    date: '2024-07-23',
    game: [GameName.Re1999],
    type: 'optimize',
    desc: lpstr(() => gt.pgettext('changelog', '增加海外服掉落数据 (使用国服同期快照)')),
  },
  {
    date: '2024-07-19',
    game: [GameName.Arknights],
    type: 'fix',
    desc: lpstr(() => gt.pgettext('changelog', '从 MAA 导入仓库时保留不支持识别的道具')),
  },
  {
    date: '2024-07-13',
    game: [GameName.Re1999],
    type: 'new',
    desc: lpstr(() => gt.pgettext('changelog', '增加共鸣调频支持')),
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
    game: [GameName.Re1999, GameName.Arknights],
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
  { date: '2023-07-17', game: [GameName.Re1999], type: 'optimize', desc: '追加材料掉率表中的价值数据' },
  { date: '2023-07-17', type: 'new', desc: '区分价值“体力”（蓝黑色）和实际体力（蓝色）' },
  { date: '2023-07-09', type: 'new', desc: '刷本规划中增加单次理智和样本数显示' },
  { date: '2023-07-09', game: [GameName.Arknights], type: 'fix', desc: '修复 Firefox 下仓库展示' },
  { date: '2023-07-09', game: [GameName.Re1999], type: 'optimize', desc: '优化货币图标' },
  { date: '2023-07-07', game: [GameName.Arknights], type: 'fix', desc: '适配新解包道具稀有度格式' },
  { date: '2023-07-02', type: 'new', desc: '增加“按游戏内仓库排布形式展示”按钮' },
  { date: '2023-07-01', type: 'optimize', desc: '计算结果中展示暂无可计算来源的材料' },
  { date: '2023-07-01', game: [GameName.Re1999], type: 'optimize', desc: '优化道具排序顺序' },
  { date: '2023-07-01', type: 'fix', desc: '修复重载数据按钮' },
  { date: '2023-06-21', game: [GameName.Re1999], type: 'optimize', desc: '使用 yuanyan3060 提供的解包数据' },
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
] as {
  date: string
  game?: GameName[]
  type: 'new' | 'fix' | 'optimize'
  desc: PSTR | PSTR[]
  children?: React.ReactNode
  href?: string
}[]

const iconMap = {
  optimize: 'key-command',
  new: 'star',
  fix: 'build',
} satisfies Record<string, IconName>

export const LogPanel = memo(({ onClose }: { onClose: () => any }) => {
  const ga = useGameAdapter()
  const groupedLogs = useMemo(() => groupLog(ga.getCodename() as GameName), [ga])
  return (
    <Drawer
      isOpen={true}
      onClose={onClose}
      position="left"
      size={'300px'}
      title={gt.gettext('更新笔记')}
      icon={'automatic-updates'}
    >
      <Menu style={{ flex: 1, flexShrink: 1, overflow: 'auto' }}>
        {Object.entries(groupedLogs).map(([k, v]) => {
          return <LogGroup key={k} title={k} items={v!} />
        })}
      </Menu>
    </Drawer>
  )
})

const LogGroup = memo(({ title, items }: { title: React.ReactNode; items: typeof logs }) => {
  return (
    <>
      <MenuDivider title={title} />
      {items.map((vv, index) => {
        return (
          <MenuItem
            key={index}
            href={vv.href}
            className={vv.children || vv.href ? undefined : 'cpp-menu-not-interactive'}
            icon={vv.type in iconMap ? (iconMap as any)[vv.type] : ''}
            text={
              <div className="cpp-menu-semi-secondary">
                <PSTRs strings={vv.desc} />
              </div>
            }
            multiline={true}
            children={vv.children}
            popoverProps={{ usePortal: true }}
            {...(vv.href ? externalLinkProps : {})}
          />
        )
      })}
    </>
  )
})

function groupLog(codename: GameName) {
  const sortedLogs = sortBy((x) => x.date, logs.slice(0).reverse())
    .reverse()
    .filter((x) => (x.game ? x.game.includes(codename) : true))
  return groupBy((x) => x.date, sortedLogs)
}

export const SimpleLogList = memo(() => {
  const ga = useGameAdapter()
  const groupedLogs = useMemo(() => Object.entries(groupLog(ga.getCodename() as GameName)), [ga])
  const { add } = useChamber()

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
      <MenuItem
        icon="double-chevron-right"
        text={gt.gettext('查看更多…')}
        onClick={() => {
          add(LogPanel)
        }}
      />
    </>
  )
})
