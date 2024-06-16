import { Button, Icon, Menu, MenuDivider, MenuItem, Popover, Tag } from '@blueprintjs/core'
import { memo } from 'react'
import { PSTRs } from './components/LineBreaks'
import { gt } from './pkg/gt'

const locales = {
  zh_Hans: {
    name: 'Chinese (Simplified)',
    localizedName: '简体中文',
  },
  en_US: {
    name: 'English (United States)',
    localizedName: 'English (United States)',
    loader: () => import('../po/en_US.json'),
  },
} as Record<string, { name: string; localizedName: string; loader?: () => Promise<object> }>

const LOCALE_STORAGE_KEY = 'cpp$locale'

let currentLocale = ''

export async function setupLocale() {
  const locale = localStorage.getItem(LOCALE_STORAGE_KEY) || 'zh_Hans'
  if (!Object.prototype.hasOwnProperty.call(locales, locale)) return
  currentLocale = locale
  const loc = locales[locale]
  if (loc.loader) {
    gt.addTranslations(locale, 'messages', await loc.loader())
  }
  gt.setLocale(locale)
}

function setLocale(locale: string) {
  if (!Object.prototype.hasOwnProperty.call(locales, locale)) return
  if (currentLocale === locale) return
  localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  const str = [
    'UI Language changed. A reload is required.',
    '语言已切换，将重新载入页面。',
    gt.gettext('语言已切换，将重新载入页面。'),
  ]
  alert([...new Set(str)].join('\n'))
  location.reload()
}

export const LocaleButton = memo(() => {
  return (
    <Popover
      usePortal={true}
      minimal={true}
      content={
        <Menu style={{ maxWidth: '300px' }}>
          <MenuDivider title={<PSTRs strings={['UI Language', '界面语言', gt.gettext('界面语言')]} />} />
          {Object.entries(locales).map(([k, x]) => {
            return (
              <MenuItem
                key={k}
                text={<PSTRs strings={[x.name, x.localizedName]} />}
                labelElement={
                  <Tag minimal style={{ fontFamily: 'monospace' }}>
                    {k}
                  </Tag>
                }
                active={k === currentLocale}
                onClick={() => {
                  setLocale(k)
                }}
              />
            )
          })}
        </Menu>
      }
      position="bottom-right"
    >
      <Button
        icon={
          <>
            <Icon icon={'translate'} />
          </>
        }
        minimal={true}
        rightIcon={'chevron-down'}
      >
        <Tag minimal style={{ fontFamily: 'monospace' }} className="cpp-very-compact">
          {currentLocale}
        </Tag>
      </Button>
    </Popover>
  )
})
