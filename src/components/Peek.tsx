import { Button, Overlay2, Popover, PopoverProps } from '@blueprintjs/core'
import { useAtom, useAtomValue, useSetAtom, useStore } from 'jotai'
import { selectAtom } from 'jotai/utils'
import React, { createContext, memo, useContext, useEffect, useId, useMemo, useRef, useState } from 'react'
import useEvent from 'react-use-event-hook'
import { useGameAdapter } from '../Cpp'
import { useComponents } from '../hooks/useComponents'
import { gt } from '../pkg/gt'
import { menuItemKeyDown, raisePortal } from './CharacterList'
import { itemPeekKind } from './ItemPeek'
import { currentWindowEpoch, dossierAtom } from './dossierHooks'
import { useFocusFrame, useRequestFrame } from './focusFrame'
import {
  PeekKind,
  PeekRef,
  PeekStack,
  boardLayerAtom,
  findPinned,
  openPeekAtom,
  peekKey,
  pinPeek,
  pinnedPeeksAtom,
  popPeek,
  pushPeek,
  raiseBoard,
  replacePinned,
  topOf,
  unpinPeek,
} from './peek'

/** 通用部分自带物品卡，其余由游戏登记 */
export function usePeekKinds(): Record<string, PeekKind> {
  const { peekKinds } = useComponents()
  return useMemo(() => ({ item: itemPeekKind, ...peekKinds }), [peekKinds])
}

const PeekTitleIdContext = createContext<string | undefined>(undefined)

/** 种类的 Head 用它画标题栏左半边；名字同时是卡片的无障碍名称 */
export const PeekHead = ({ icon, title, sub }: { icon?: React.ReactNode; title: string; sub?: React.ReactNode }) => {
  const titleId = useContext(PeekTitleIdContext)
  return (
    <div className="cpp-peek-head-main">
      {icon != null ? <span className="cpp-peek-icon">{icon}</span> : null}
      <div className="cpp-peek-titles">
        <div className="cpp-peek-title" id={titleId} title={title}>
          {title}
        </div>
        {sub != null ? <div className="cpp-peek-sub">{sub}</div> : null}
      </div>
    </div>
  )
}

/** 钉住、点已经钉住的东西时：钉板排到窗口上面，那一张滚到眼前、框出来 */
function useShowPinned() {
  const frame = useRequestFrame()
  const setLayer = useSetAtom(boardLayerAtom)
  // 不看是不是在窗口里点的：从档案「养成成本」钉住时，档案也可能排在窗口上面，而档案拿不到 PopOutWindowContext
  return useEvent((ref: PeekRef) => {
    setLayer((layer) => raiseBoard(layer, currentWindowEpoch()))
    frame('peek:' + peekKey(ref))
  })
}

export const PeekCard = memo(
  ({
    stack,
    pinned,
    onNavigate,
    onPin,
    onClose,
  }: {
    stack: PeekStack
    pinned: boolean
    onNavigate: (stack: PeekStack) => void
    /** 没钉时有 */
    onPin?: () => void
    /** 钉住时有；没钉时有的话，这样东西不在数据里时画成关闭按钮 */
    onClose?: () => void
  }) => {
    const ga = useGameAdapter()
    const ref = topOf(stack)
    const kind = usePeekKinds()[ref.kind]
    const exists = !!kind && kind.exists(ga, ref.id)
    const titleId = useId()
    const navigate = useEvent((next: PeekRef) => onNavigate(pushPeek(stack, next)))
    const back = useEvent(() => onNavigate(popPeek(stack)))
    const backLabel = gt.pgettext('peek card', '返回')
    const pinLabel = gt.pgettext('peek card', '钉住')
    return (
      <div className="cpp-peek-card" role="dialog" aria-labelledby={titleId} tabIndex={-1}>
        <div className="cpp-peek-head">
          {stack.length > 1 ? (
            <Button
              variant="minimal"
              size="small"
              icon="chevron-left"
              title={backLabel}
              aria-label={backLabel}
              onClick={back}
            />
          ) : null}
          <PeekTitleIdContext.Provider value={titleId}>
            {exists ? <kind.Head id={ref.id} /> : <PeekHead title={ref.id} />}
          </PeekTitleIdContext.Provider>
          {!pinned && exists ? (
            <Button variant="minimal" size="small" icon="pin" title={pinLabel} aria-label={pinLabel} onClick={onPin} />
          ) : (
            <Button
              variant="minimal"
              size="small"
              icon="cross"
              title={gt.gettext('关闭')}
              aria-label={gt.gettext('关闭')}
              onClick={onClose}
            />
          )}
        </div>
        <div className="cpp-peek-body">
          {exists ? (
            // 换成同一种的另一样东西时，悬停的合成档位之类不带过去
            <kind.Body key={peekKey(ref)} id={ref.id} navigate={navigate} />
          ) : (
            <div className="cpp-peek-missing">{gt.pgettext('peek card', '已不在现在的数据里')}</div>
          )}
        </div>
      </div>
    )
  },
)

// 纵向放不下时往上挪，顶上让出 40px 的顶栏
const peekPopoverModifiers: PopoverProps['modifiers'] = {
  preventOverflow: { options: { padding: { top: 48, right: 8, bottom: 8, left: 8 } } },
}

/** Blueprint 把焦点放在卡片外面的陷阱元素上，要 Tab 两下才到图钉；直接放在卡片上，下一帧它看到焦点已经在里面就不动 */
function onOpening(node: HTMLElement) {
  raisePortal(node)
  node.querySelector<HTMLElement>('.cpp-peek-card')?.focus({ preventScroll: true })
}

export interface PeekTargetProps {
  ref: React.Ref<any>
  onClick: React.MouseEventHandler
  /** Enter、空格等于点击；原生 button 上不需要但无害 */
  onKeyDown: React.KeyboardEventHandler
  tabIndex: 0
  'aria-haspopup': 'dialog'
  'aria-expanded': boolean
  /** 'cpp-peek-target'（整块）或 'cpp-peek-inline'（句子里的词），开着时加 ' is-open'；调用处接在自己的类后面 */
  className: string
}

/**
 * 包住能点开卡片的东西：点了在旁边弹出这样东西的卡片，同一时间只有一张；已经钉住时不弹，改为框出钉板里那张。
 * 不给 role：Blueprint 的 MenuItem 自带 menuitem，其余调用处自己给 button
 */
export const PeekTrigger = ({
  peek,
  inline,
  renderTarget,
}: {
  peek: PeekRef
  inline?: boolean
  /** props 为 null：这一种没登记，原样画、不能点 */
  renderTarget: (props: PeekTargetProps | null) => React.ReactElement
}) => {
  const kind = usePeekKinds()[peek.kind]
  const anchor = useId()
  const store = useStore()
  // 每一处只订阅自己开着没有，换一张卡片时只有开关变了的两处重画
  const openAtom = useMemo(() => selectAtom(openPeekAtom, (x) => (x?.anchor === anchor ? x : null)), [anchor])
  const open = useAtomValue(openAtom)
  const setOpen = useSetAtom(openPeekAtom)
  const setPins = useSetAtom(pinnedPeeksAtom)
  const showPinned = useShowPinned()
  // 关上以后 Popover 还要画着它淡出；content 一空，Popover 就换掉整个目标，焦点回不来
  const [last, setLast] = useState<PeekStack>([peek])
  if (open && open.stack !== last) setLast(open.stack)
  const shown = open?.stack ?? last

  const close = useEvent(() => setOpen((x) => (x?.anchor === anchor ? null : x)))
  // 虚拟滚动把它滚走了、所在的行没了：开着的正是自己就关上
  useEffect(() => close, [close])

  const target = useRef<HTMLElement | null>(null)
  const onClick = useEvent((e: React.MouseEvent) => {
    target.current = e.currentTarget as HTMLElement
    if (findPinned(store.get(pinnedPeeksAtom), peek) >= 0) {
      close()
      showPinned(peek)
    } else if (open) close()
    else setOpen({ stack: [peek], anchor })
  })
  const onNavigate = useEvent((stack: PeekStack) => setOpen({ stack, anchor }))
  const onPin = useEvent(() => {
    const stack = shown
    setPins((pins) => pinPeek(pins, stack))
    close()
    showPinned(topOf(stack))
  })

  if (!kind) return renderTarget(null)
  return (
    <Popover
      isOpen={open != null}
      onInteraction={(next) => {
        if (!next) close()
      }}
      placement="right"
      popoverClassName="cpp-peek-popover"
      autoFocus
      enforceFocus={false}
      // Blueprint 还焦点时不看焦点已经去了哪里，而且会把列表滚到这一行：卡片随行滚走以后点另一样东西，列表就跳回来。
      // 只在焦点跟着卡片没了时还，不滚动
      shouldReturnFocusOnClose={false}
      modifiers={peekPopoverModifiers}
      onOpening={onOpening}
      onClosed={(node) => {
        const active = document.activeElement
        if (active == null || active === document.body || node.contains(active))
          target.current?.focus({ preventScroll: true })
      }}
      content={<PeekCard stack={shown} pinned={false} onNavigate={onNavigate} onPin={onPin} onClose={close} />}
      renderTarget={({ ref }) =>
        renderTarget({
          ref,
          onClick,
          onKeyDown: menuItemKeyDown,
          tabIndex: 0,
          'aria-haspopup': 'dialog',
          'aria-expanded': open != null,
          className: (inline ? 'cpp-peek-inline' : 'cpp-peek-target') + (open ? ' is-open' : ''),
        })
      }
    />
  )
}

const PinnedCard = memo(({ stack, index }: { stack: PeekStack; index: number }) => {
  const setPins = useSetAtom(pinnedPeeksAtom)
  const ref = useRef<HTMLDivElement>(null)
  const framed = useFocusFrame('peek:' + peekKey(topOf(stack)), ref)
  const onNavigate = useEvent((next: PeekStack) => setPins((pins) => replacePinned(pins, index, next)))
  const onClose = useEvent(() => setPins((pins) => unpinPeek(pins, index)))
  return (
    <div ref={ref} className={'cpp-peek-pinned' + (framed ? ' cpp-framed' : '')}>
      <PeekCard stack={stack} pinned onNavigate={onNavigate} onClose={onClose} />
    </div>
  )
})

/** 卡里换过东西的两张可能一模一样，后面的加序号；别的卡片关掉时，其余的 key 不变 */
function pinKeys(pins: readonly PeekStack[]) {
  const seen = new Map<string, number>()
  return pins.map((stack) => {
    const key = stack.map(peekKey).join(' ')
    const n = seen.get(key) ?? 0
    seen.set(key, n + 1)
    return n ? `${key}#${n}` : key
  })
}

/** 钉住的卡片，在 App.tsx 里挂一次 */
export const PeekBoard = memo(() => {
  const [pins, setPins] = useAtom(pinnedPeeksAtom)
  const { generation } = useAtomValue(boardLayerAtom)
  const besideDossier = useAtomValue(dossierAtom) != null
  if (pins.length === 0) return null
  const keys = pinKeys(pins)
  return (
    // 和档案一样：浮层按 portal 第一次建出来的先后叠放，换 key 重新挂载才排到之后打开的窗口上面
    <Overlay2
      key={generation}
      isOpen
      usePortal
      hasBackdrop={false}
      autoFocus={false}
      enforceFocus={false}
      canEscapeKeyClose={false}
      canOutsideClickClose={false}
    >
      <div
        className={'cpp-peek-board' + (besideDossier ? ' is-beside-dossier' : '')}
        role="region"
        aria-label={gt.pgettext('peek card', '钉住的卡片')}
      >
        {pins.length > 1 ? (
          <Button
            className="cpp-peek-board-clear"
            size="small"
            text={gt.pgettext('peek card', '全部关闭')}
            onClick={() => setPins([])}
          />
        ) : null}
        {pins.map((stack, i) => (
          <PinnedCard key={keys[i]} stack={stack} index={i} />
        ))}
      </div>
    </Overlay2>
  )
})
