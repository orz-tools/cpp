import { Button, Icon, Menu, MenuDivider, MenuItem, Popover, Tag } from '@blueprintjs/core'
import { CSSProperties, Fragment, ReactNode, memo, useSyncExternalStore } from 'react'
import { PSTRs } from './components/LineBreaks'
import { showAlert } from './components/MessageBox'
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
const loadedLocales = new Set<string>()
const localeListeners = new Set<() => void>()

export function getLocale() {
  return currentLocale
}

export function subscribeLocale(listener: () => void) {
  localeListeners.add(listener)
  return () => void localeListeners.delete(listener)
}

async function loadLocale(locale: string) {
  const loc = locales[locale]
  if (loc.loader && !loadedLocales.has(locale)) {
    gt.addTranslations(locale, 'messages', await loc.loader())
    loadedLocales.add(locale)
  }
}

export async function setupLocale() {
  const locale = localStorage.getItem(LOCALE_STORAGE_KEY) || 'zh_Hans'
  if (!Object.prototype.hasOwnProperty.call(locales, locale)) return
  currentLocale = locale
  await loadLocale(locale)
  gt.setLocale(locale)
}

async function setLocale(locale: string) {
  if (!Object.prototype.hasOwnProperty.call(locales, locale)) return
  if (currentLocale === locale) return
  try {
    await loadLocale(locale)
  } catch (e) {
    console.error(e)
    void showAlert(`${gt.gettext('切换语言失败')}\n${e instanceof Error ? e.message : String(e)}`)
    return
  }
  localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  gt.setLocale(locale)
  currentLocale = locale
  for (const listener of localeListeners) listener()
}

/** Mounts its children again whenever the UI language changes, so every string is translated anew. */
export const LocaleBoundary = ({ children }: { children: ReactNode }) => {
  const locale = useSyncExternalStore(subscribeLocale, getLocale)
  return <Fragment key={locale}>{children}</Fragment>
}

/** 顶栏「界面语言」弹出的菜单；手机上是「更多 › 界面语言」那一页 */
export const LocaleMenu = memo(({ className, style }: { className?: string; style?: CSSProperties }) => {
  return (
    <Menu className={className} style={style}>
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
            onClick={() => void setLocale(k)}
          />
        )
      })}
    </Menu>
  )
})

const localeMenuStyle: CSSProperties = { maxWidth: '300px' }

export const LocaleButton = memo(() => {
  return (
    <Popover usePortal={true} minimal={true} content={<LocaleMenu style={localeMenuStyle} />} position="bottom-right">
      <Button
        icon={
          <>
            <Icon icon={'translate'} />
          </>
        }
        variant="minimal"
        endIcon={'chevron-down'}
      >
        <Tag minimal style={{ fontFamily: 'monospace' }} className="cpp-very-compact">
          {currentLocale}
        </Tag>
      </Button>
    </Popover>
  )
})
