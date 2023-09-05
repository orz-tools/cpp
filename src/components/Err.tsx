import { atom } from 'jotai'

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
