import Gettext from 'node-gettext'

export const gt = new Gettext()
export type PSTR = string | LPSTR
export type LPSTR = { toString(): string; valueOf(): string }

export function lpstr(s: () => string): LPSTR {
  return { toString: s, valueOf: s }
}
