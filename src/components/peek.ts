import { PrimitiveAtom, atom } from 'jotai'
import type React from 'react'
import type { IGameAdapter } from '../pkg/cpp-basic'

/** 卡片里的一样东西，例如 { kind: 'item', id: '30145' }、{ kind: 'stage', id: 'main_01-07' } */
export interface PeekRef {
  kind: string
  id: string
}

/** 一张卡片：最前是被点的东西，最后是现在显示的；卡里点配方、掉落时往后加 */
export type PeekStack = readonly PeekRef[]

/** 钉板去重、框出都用它 */
export function peekKey(ref: PeekRef): string {
  return `${ref.kind}:${ref.id}`
}

export function topOf(stack: PeekStack): PeekRef {
  return stack[stack.length - 1]
}

const sameRef = (a: PeekRef, b: PeekRef) => a.kind === b.kind && a.id === b.id

/** 和最后一项相同时原样返回 */
export function pushPeek(stack: PeekStack, ref: PeekRef): PeekStack {
  return sameRef(topOf(stack), ref) ? stack : [...stack, ref]
}

/** 只有一项时原样返回 */
export function popPeek(stack: PeekStack): PeekStack {
  return stack.length > 1 ? stack.slice(0, -1) : stack
}

/** 最后一项是 ref 的那张；没有是 -1 */
export function findPinned(pins: readonly PeekStack[], ref: PeekRef): number {
  return pins.findIndex((stack) => sameRef(topOf(stack), ref))
}

/** 加在钉板最下面；最后一项已经钉住时原样返回 */
export function pinPeek(pins: readonly PeekStack[], stack: PeekStack): readonly PeekStack[] {
  return findPinned(pins, topOf(stack)) >= 0 ? pins : [...pins, stack]
}

export function unpinPeek(pins: readonly PeekStack[], index: number): readonly PeekStack[] {
  return pins.filter((_, i) => i !== index)
}

export function replacePinned(pins: readonly PeekStack[], index: number, stack: PeekStack): readonly PeekStack[] {
  return pins.map((x, i) => (i === index ? stack : x))
}

export interface OpenPeek {
  stack: PeekStack
  /** 被点的那个 PeekTrigger 的 useId()：同一样东西画在好几处时，只有被点的那一处弹卡 */
  anchor: string
}

// 每个档案有自己的 store，所以换档案、刷新就清空；不进用户数据，没有撤销
/** 没钉的那一张，全站只有一张 */
export const openPeekAtom: PrimitiveAtom<OpenPeek | null> = atom<OpenPeek | null>(null)
export const pinnedPeeksAtom: PrimitiveAtom<readonly PeekStack[]> = atom<readonly PeekStack[]>([])

/** 钉板的层次，和档案的 DossierState 一样 */
export interface BoardLayer {
  /** 钉板 Overlay2 的 key；加一时钉板重新挂载，排到所有已打开的窗口上面 */
  generation: number
  /** 钉板上一次挂载时，已经打开过多少个窗口 */
  epoch: number
}

export const boardLayerAtom: PrimitiveAtom<BoardLayer> = atom<BoardLayer>({ generation: 0, epoch: 0 })

/** epoch 是 currentWindowEpoch()：比钉板记下的新时，generation + 1、记下这个 epoch；否则原样返回 */
export function raiseBoard(layer: BoardLayer, epoch: number): BoardLayer {
  return epoch > layer.epoch ? { generation: layer.generation + 1, epoch } : layer
}

/** 一种卡片。通用部分登记 item，游戏在 IGameComponent.peekKinds 里登记自己的 */
export interface PeekKind {
  /** 标题栏左半边：图标（28px）、名字、一行小字；用 PeekHead 画 */
  Head: React.FC<{ id: string }>
  /** 内容。navigate 在同一张卡里换成另一样东西（配方、掉落行用） */
  Body: React.FC<{ id: string; navigate: (ref: PeekRef) => void }>
  /** 数据更新后这样东西还在不在；不在时卡片只写「已不在现在的数据里」 */
  exists: (ga: IGameAdapter<any>, id: string) => boolean
}
