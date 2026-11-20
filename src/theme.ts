import { Classes } from '@blueprintjs/core'
import { useSyncExternalStore } from 'react'

export type ThemeSetting = 'system' | 'light' | 'dark'
export const THEME_SETTINGS: readonly ThemeSetting[] = ['system', 'light', 'dark']
export const THEME_STORAGE_KEY = 'cpp$theme'
export const DARK_QUERY = '(prefers-color-scheme: dark)'

/** 没存过、旧值、手改坏的都按跟随系统 */
export function readThemeSetting(stored: unknown): ThemeSetting {
  return THEME_SETTINGS.includes(stored as ThemeSetting) ? (stored as ThemeSetting) : 'system'
}

export function isDark(setting: ThemeSetting, systemDark: boolean): boolean {
  return setting === 'dark' || (setting === 'system' && systemDark)
}

let setting: ThemeSetting = 'system'
let started = false
const settingListeners = new Set<() => void>()

function getSystemDark() {
  return window.matchMedia(DARK_QUERY).matches
}

function subscribeSystemDark(onChange: () => void) {
  const mql = window.matchMedia(DARK_QUERY)
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

function applyTheme() {
  document.documentElement.classList.toggle(Classes.DARK, isDark(setting, getSystemDark()))
}

/** main.tsx 一开始就调，再调一次什么也不做 */
export function startTheme(): void {
  if (started) return
  started = true
  setting = readThemeSetting(localStorage.getItem(THEME_STORAGE_KEY))
  applyTheme()
  // 设置是浅色、深色时也一直监听：之后随时可能改回跟随系统
  subscribeSystemDark(applyTheme)
}

export function getThemeSetting(): ThemeSetting {
  return setting
}

export function setThemeSetting(next: ThemeSetting): void {
  if (next === setting) return
  localStorage.setItem(THEME_STORAGE_KEY, next)
  setting = next
  applyTheme()
  for (const listener of settingListeners) listener()
}

function subscribeThemeSetting(listener: () => void) {
  settingListeners.add(listener)
  return () => void settingListeners.delete(listener)
}

export function useThemeSetting(): ThemeSetting {
  return useSyncExternalStore(subscribeThemeSetting, getThemeSetting)
}

export function useSystemDark(): boolean {
  return useSyncExternalStore(subscribeSystemDark, getSystemDark)
}
