import { Alignment, Navbar, Menu, MenuItem, Blockquote, MenuDivider, IconName } from '@blueprintjs/core'
import { BlueprintIcons_16 } from '@blueprintjs/icons/lib/esm/generated-icons/16px/blueprint-icons-16'
import { groupBy, sortBy } from 'ramda'
import React from 'react'

const externalLinkProps = {
  rel: 'noreferrer noopener',
  referrerPolicy: 'no-referrer',
  target: '_blank',
} satisfies React.AnchorHTMLAttributes<HTMLAnchorElement>

const logs = [
  { date: '2023-04-23', type: 'optimize', desc: '以价值排序刷图产物' },
  { date: '2023-04-23', type: 'fix', desc: '任务完成时正确消耗经验道具' },
  { date: '2023-04-23', type: 'fix', desc: '复刻的插曲关卡数据' },
]

const sortedLogs = sortBy((x) => x.date, logs.reverse()).reverse()
const groupedLogs = groupBy((x) => x.date, sortedLogs)

const iconMap = {
  optimize: 'key-command',
  fix: 'build',
} satisfies Record<string, IconName>

export function LogList() {
  return (
    <>
      <Navbar>
        <Navbar.Group align={Alignment.RIGHT}></Navbar.Group>
        <Navbar.Group align={Alignment.LEFT}>更新日志</Navbar.Group>
      </Navbar>
      <Menu style={{ flex: 1, flexShrink: 1, overflow: 'auto' }}>
        {Object.entries(groupedLogs).map(([k, v]) => {
          return (
            <React.Fragment key={k}>
              <MenuDivider title={k} />
              {v.map((vv) => {
                return (
                  <MenuItem
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
