import { atom } from 'jotai'
import { gt } from '../pkg/gt'

export interface Err {
  error?: any
  context?: string
  friendly?: string
}

export const ErrAtom = atom<Err | undefined>(undefined)

export class FriendlyError extends Error {
  public constructor(message?: string, options?: ErrorOptions) {
    super(message, options)
  }
}

/** The advice every message about data that did not load or download carries; one string, so one translation. */
export const networkAdvice = () => gt.gettext('请检查网络连接/更换网络/使用「加速器」/切换线路。')
