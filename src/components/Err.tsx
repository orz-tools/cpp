import { atom } from 'jotai'

export const ErrAtom = atom<{ error: any; context: string } | undefined>(undefined)
