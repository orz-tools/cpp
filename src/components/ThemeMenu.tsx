import { Button, IconName, Menu, MenuDivider, MenuItem, Popover } from '@blueprintjs/core'
import { memo } from 'react'
import { gt } from '../pkg/gt'
import { THEME_SETTINGS, ThemeSetting, setThemeSetting, useSystemDark, useThemeSetting } from '../theme'

const THEME_ICONS: Record<ThemeSetting, IconName> = { system: 'desktop', light: 'flash', dark: 'moon' }

export function themeIcon(setting: ThemeSetting): IconName {
  return THEME_ICONS[setting]
}

export function themeName(setting: ThemeSetting): string {
  switch (setting) {
    case 'system':
      return gt.pgettext('theme', '跟随系统')
    case 'light':
      return gt.pgettext('theme', '浅色')
    case 'dark':
      return gt.pgettext('theme', '深色')
  }
}

/** 顶栏「外观」弹出的菜单；手机上是「更多 › 外观」那一页 */
export const ThemeMenu = memo(({ className }: { className?: string }) => {
  const setting = useThemeSetting()
  const systemDark = useSystemDark()
  return (
    <Menu className={className}>
      <MenuDivider title={gt.gettext('外观')} />
      {THEME_SETTINGS.map((s) => (
        <MenuItem
          key={s}
          icon={themeIcon(s)}
          text={themeName(s)}
          label={s === 'system' ? themeName(systemDark ? 'dark' : 'light') : undefined}
          active={s === setting}
          onClick={() => setThemeSetting(s)}
        />
      ))}
    </Menu>
  )
})

export const ThemeButton = memo(() => {
  const setting = useThemeSetting()
  const label = gt.gettext('外观')
  return (
    <Popover usePortal={true} minimal={true} content={<ThemeMenu />} position="bottom-right">
      <Button variant="minimal" icon={themeIcon(setting)} endIcon="chevron-down" title={label} aria-label={label} />
    </Popover>
  )
})
