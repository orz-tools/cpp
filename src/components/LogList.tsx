import { Alignment, IconName, Menu, MenuDivider, MenuItem, Navbar } from '@blueprintjs/core'
import { groupBy, sortBy } from 'ramda'
import React, { useMemo } from 'react'
import { useGameAdapter } from '../Cpp'
import { GameName } from '../games'

const logs = [
  { date: '2023-08-27', game: [GameName.Arknights], type: 'optimize', desc: '增加森空岛数据导入功能' },
  { date: '2023-08-25', type: 'optimize', desc: '角色头像右键菜单增加资料站链接' },
  { date: '2023-08-25', type: 'optimize', desc: '优化计算性能' },
  { date: '2023-08-25', type: 'fix', desc: '修复一些数字输不进去的问题' },
  { date: '2023-08-18', type: 'optimize', desc: '优化图片资源加载' },
  { date: '2023-08-16', type: 'optimize', desc: '优化列表性能' },
  { date: '2023-07-24', type: 'optimize', desc: '增加规划目标选择' },
  { date: '2023-07-22', type: 'optimize', desc: '部分数据源迁移至 CDN' },
  { date: '2023-07-22', type: 'optimize', desc: '重新设计数据更新功能' },
  { date: '2023-07-22', type: 'optimize', desc: '优化统一部分 UI/UX' },
  { date: '2023-07-22', type: 'optimize', desc: '增加用户数据管理（导入/导出）' },
  { date: '2023-07-17', game: [GameName.Re1999], type: 'optimize', desc: '追加材料掉率表中的价值数据' },
  { date: '2023-07-17', type: 'optimize', desc: '区分价值“体力”（蓝黑色）和实际体力（蓝色）' },
  { date: '2023-07-09', type: 'optimize', desc: '刷本规划中增加单次理智和样本数显示' },
  { date: '2023-07-09', game: [GameName.Arknights], type: 'fix', desc: '修复 Firefox 下仓库展示' },
  { date: '2023-07-09', game: [GameName.Re1999], type: 'optimize', desc: '优化货币图标' },
  { date: '2023-07-07', game: [GameName.Arknights], type: 'fix', desc: '适配新解包物品稀有度格式' },
  { date: '2023-07-02', type: 'optimize', desc: '增加“按游戏内仓库排布形式展示”按钮' },
  { date: '2023-07-01', type: 'optimize', desc: '计算结果中展示暂无可计算来源的材料' },
  { date: '2023-07-01', game: [GameName.Re1999], type: 'optimize', desc: '优化道具排序顺序' },
  { date: '2023-07-01', type: 'fix', desc: '修复重载数据按钮' },
  { date: '2023-06-21', game: [GameName.Re1999], type: 'optimize', desc: '使用 yuanyan3060 提供的解包数据' },
  { date: '2023-06-14', game: [GameName.Arknights], type: 'fix', desc: '修复经验间接计算问题' },
  { date: '2023-06-14', type: 'optimize', desc: '优化分栏顺序' },
  { date: '2023-06-13', type: 'optimize', desc: '支持一些其他游戏' },
  { date: '2023-06-13', type: 'optimize', desc: '支持多个游戏角色' },
  { date: '2023-06-08', game: [GameName.Arknights], type: 'fix', desc: '换回 Kengxxiao 的数据源 🌚' },
  { date: '2023-05-03', game: [GameName.Arknights], type: 'fix', desc: '换用 yuanyan3060 的数据源' },
  { date: '2023-05-02', game: [GameName.Arknights], type: 'fix', desc: '随便适配一下新数据，但不完全工作' },
  { date: '2023-04-23', type: 'optimize', desc: '以价值排序刷图产物' },
  { date: '2023-04-23', type: 'fix', desc: '任务完成时正确消耗经验道具' },
  { date: '2023-04-23', game: [GameName.Arknights], type: 'fix', desc: '修复复刻的插曲关卡数据' },
] as { date: string; game?: GameName[]; type: 'fix' | 'optimize'; desc: string }[]

const iconMap = {
  optimize: 'key-command',
  fix: 'build',
} satisfies Record<string, IconName>

export function LogList() {
  const ga = useGameAdapter()
  const groupedLogs = useMemo(() => {
    const cn = ga.getCodename() as GameName
    const sortedLogs = sortBy((x) => x.date, logs.reverse())
      .reverse()
      .filter((x) => (x.game ? x.game.includes(cn) : true))
    return groupBy((x) => x.date, sortedLogs)
  }, [ga])
  return (
    <>
      <Navbar>
        <Navbar.Group align={Alignment.RIGHT} />
        <Navbar.Group align={Alignment.LEFT}>更新日志</Navbar.Group>
      </Navbar>
      <Menu style={{ flex: 1, flexShrink: 1, overflow: 'auto' }}>
        {Object.entries(groupedLogs).map(([k, v]) => {
          return (
            <React.Fragment key={k}>
              <MenuDivider title={k} />
              {v.map((vv, index) => {
                return (
                  <MenuItem
                    key={index}
                    className="cpp-menu-not-interactive"
                    icon={vv.type in iconMap ? (iconMap as any)[vv.type] : ''}
                    text={<div className="cpp-menu-semi-secondary">{vv.desc}</div>}
                    multiline={true}
                  />
                )
              })}
            </React.Fragment>
          )
        })}
      </Menu>
    </>
  )
}
