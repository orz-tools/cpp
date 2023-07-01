import { Alignment, IconName, Menu, MenuDivider, MenuItem, Navbar } from '@blueprintjs/core'
import { groupBy, sortBy } from 'ramda'
import React, { useMemo } from 'react'
import { useGameAdapter } from '../Cpp'
import { GameName } from '../games'

const logs = [
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
                    icon={vv.type in iconMap ? (iconMap as any)[vv.type] : ''}
                    text={<div style={{ fontWeight: 'normal', opacity: 0.75 }}>{vv.desc}</div>}
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
