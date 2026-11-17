import { Icon, IconName, Tooltip } from '@blueprintjs/core'
import { format } from 'date-fns'
import React, { memo, useEffect, useRef, useState } from 'react'
import { badUrl, blobImage, load } from '../../pkg/blobcache'
import { Character, DeployableProfession, ProfessionNames } from '../../pkg/cpp-arknights'
import { DAY, SkinChannel, SkinPeriod, SkinWindow } from '../../pkg/cpp-arknights/skins'
import { PSTR, gt, lpstr } from '../../pkg/gt'
import type { SkinState } from './skinsModel'

// ---------------------------------------------------------------------------------------------------------------------
// 文字

const channelNames: Record<SkinChannel, PSTR> = {
  shop: lpstr(() => gt.pgettext('skins', '时装商店')),
  retro: lpstr(() => gt.pgettext('skins', '风尚回顾')),
  certificate: lpstr(() => gt.pgettext('skins', '凭证交易所')),
  record: lpstr(() => gt.pgettext('skins', '记录修复')),
  contract: lpstr(() => gt.pgettext('skins', '危机合约兑换')),
  milestone: lpstr(() => gt.pgettext('skins', '里程碑奖励')),
  mission: lpstr(() => gt.pgettext('skins', '任务奖励')),
  event: lpstr(() => gt.pgettext('skins', '活动')),
}

const channelIcons: Record<SkinChannel, IconName> = {
  shop: 'shop',
  retro: 'shop',
  certificate: 'exchange',
  record: 'history',
  contract: 'exchange',
  milestone: 'flag',
  mission: 'flag',
  event: 'calendar',
}

export const channelName = (channel: SkinChannel) => channelNames[channel].toString()

/** 圆标和文字的颜色：时装商店（含风尚回顾）橙色，凭证交易所绿色，其余灰色 */
export function channelTone(channel: SkinChannel) {
  return channel === 'shop' || channel === 'retro' ? 'shop' : channel === 'certificate' ? 'cert' : 'perm'
}

/** 档期图上一期的名字：新装、复刻，其余是渠道名 */
export function periodName(p: Pick<SkinPeriod, 'lane' | 'channel'>) {
  if (p.lane === 'first') return gt.pgettext('skins', '新装')
  if (p.lane === 'rerun') return gt.pgettext('skins', '复刻')
  return channelName(p.channel)
}

export const formatDay = (ms: number) => format(ms, 'yyyy-MM-dd')
export const formatMonthDay = (ms: number) => format(ms, 'MM-dd')
export const formatMinute = (ms: number) => format(ms, 'MM-dd HH:mm')

/** 价格存的是 PRTS 的原文（「18→15」这种也有）；没有单位的是源石 */
export function priceText(w: SkinWindow) {
  if (!w.price) return ''
  const unit = w.unit?.replace(/[“”"]/g, '').trim()
  return unit
    ? `${w.price} ${unit}`
    : gt
        .pgettext('skins', '%s 源石') /* I10N: %s: price */
        .replaceAll('%s', w.price)
}

/** 「至 11-21 03:59」；常驻的写「常驻」 */
export function untilText(end: number | null) {
  return end == null
    ? gt.pgettext('skins', '常驻')
    : gt
        .pgettext('skins', '至 %s') /* I10N: %s: end date and time */
        .replaceAll('%s', formatMinute(end))
}

export function daysLeftText(end: number, now: number) {
  const days = Math.floor((end - now) / DAY)
  if (days < 1) return gt.pgettext('skins', '不到 1 天')
  return gt.ngettext('还剩 %d 天', '还剩 %d 天', days).replaceAll('%d', String(days))
}

/** 一期还剩几天；已经结束、还没开始的另说 */
export function periodTimeText(period: Pick<SkinPeriod, 'start' | 'end'>, now: number) {
  if (period.start > now)
    return gt
      .pgettext('skins', '%s 开始') /* I10N: %s: start date and time */
      .replaceAll('%s', formatMinute(period.start))
  if (period.end == null) return ''
  if (period.end < now) return gt.pgettext('skins', '已结束')
  return daysLeftText(period.end, now)
}

export function acquiredText(acquiredAt: number) {
  return acquiredAt > 0
    ? gt
        .pgettext('skins', '%s 获得') /* I10N: %s: date */
        .replaceAll('%s', formatDay(acquiredAt * 1000))
    : gt.pgettext('skins', '已有')
}

/** 「风尚回顾 18 源石 · 至 11-21 03:59，还剩 3 天」 */
export function wayText(w: SkinWindow, now: number) {
  const head = [channelName(w.channel), priceText(w)].filter(Boolean).join(' ')
  const until = untilText(w.end)
  return w.end == null
    ? `${head} · ${until}`
    : gt
        .pgettext('skins', '%1 · %2，%3') /* I10N: %1: channel and price, %2: end date, %3: days left */
        .replace('%1', head)
        .replace('%2', until)
        .replace('%3', daysLeftText(w.end, now))
}

/** 一行状态：获得日期，或者从哪拿、到哪天，或者暂时拿不到 */
export function stateText(state: SkinState, now: number) {
  if (state.owned) return acquiredText(state.acquiredAt ?? 0)
  const w = state.available[0]
  return w ? wayText(w, now) : gt.pgettext('skins', '暂时拿不到')
}

/** 「干员 · 系列」；阿米娅另外几个形态的时装，系列前面加上形态的职业名 */
export function skinSubtitle(state: SkinState, character: Character | undefined) {
  const { skin } = state
  return [character?.name, formLabel(skin.tmplId, character), skin.groupName].filter(Boolean).join(' · ')
}

export function formLabel(tmplId: string | null, character: Character | undefined) {
  if (!tmplId || !character || tmplId === character.key) return ''
  return ProfessionNames[character.getPatchProfession(tmplId) as DeployableProfession]?.toString() ?? ''
}

// ---------------------------------------------------------------------------------------------------------------------
// 图片

const HYCDN = 'https://web.hycdn.cn/arknights/game/assets/char_skin'

export type SkinPictureKind = 'avatar' | 'portrait'

function scrollParent(el: Element): Element | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p)
    if (overflowY === 'auto' || overflowY === 'scroll') return p
  }
  return null
}

// One observer per scrolling container: a brand wall or the wide view mounts hundreds of pictures
const observers = new Map<Element | null, { observer: IntersectionObserver; callbacks: Map<Element, () => void> }>()

function observeNear(el: Element, onNear: () => void) {
  const root = scrollParent(el)
  let entry = observers.get(root)
  if (!entry) {
    const callbacks = new Map<Element, () => void>()
    const observer = new IntersectionObserver(
      (records) => {
        for (const r of records) if (r.isIntersecting) callbacks.get(r.target)?.()
      },
      { root, rootMargin: '200px' },
    )
    observers.set(root, (entry = { observer, callbacks }))
  }
  const { observer, callbacks } = entry
  callbacks.set(el, onNear)
  observer.observe(el)
  return () => {
    observer.unobserve(el)
    callbacks.delete(el)
    if (callbacks.size === 0) {
      observer.disconnect()
      observers.delete(root)
    }
  }
}

const LoadedPicture = memo(({ id, kind, name }: { id: string; kind: SkinPictureKind; name: string }) => {
  const data = load(blobImage([`${HYCDN}/${kind}/${encodeURIComponent(id)}.png`]))
  const [, render] = useState(0)
  useEffect(() => {
    if (typeof data === 'string') return
    let alive = true
    const done = () => alive && render((x) => x + 1)
    data.then(done, done)
    return () => {
      alive = false
    }
  }, [data])
  if (typeof data !== 'string') return null
  // 还没上线的时装 CDN 上还没有图
  if (data === badUrl) return <span className="cpp-skins-pic-missing">{name}</span>
  return <img src={data} alt="" draggable={false} />
})

/** 进入视口（上下多算 200px）才开始下载，进去过就一直挂着；取不到时灰底上写时装名 */
export const SkinPicture = memo(({ id, kind, name }: { id: string; kind: SkinPictureKind; name: string }) => {
  const ref = useRef<HTMLSpanElement>(null)
  const [near, setNear] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (near || !el) return
    return observeNear(el, () => setNear(true))
  }, [near])
  return (
    <span ref={ref} className={`cpp-skins-pic cpp-skins-pic-${kind}`}>
      {near ? <LoadedPicture id={id} kind={kind} name={name} /> : null}
    </span>
  )
})

// ---------------------------------------------------------------------------------------------------------------------
// 图上的标记

export const ChannelBadge = memo(({ channel }: { channel: SkinChannel }) => (
  <span className={`cpp-skins-badge cpp-skins-tone-${channelTone(channel)}`} aria-hidden="true">
    <Icon icon={channelIcons[channel]} size={10} />
  </span>
))

export const VoucherMark = memo(() => (
  <span className="cpp-skins-voucher" aria-hidden="true">
    {gt.pgettext('skins', '券')}
  </span>
))

export const MarkCheck = memo(({ owned }: { owned: boolean }) => (
  <span className={'cpp-skins-check' + (owned ? ' is-on' : '')} aria-hidden="true">
    {owned ? <Icon icon="small-tick" size={12} /> : null}
  </span>
))

/** 缺的灰、带虚线框；标记中画圆勾，不画渠道圆标和「券」 */
export const SkinMarks = memo(({ state, marking }: { state: SkinState; marking: boolean }) => {
  if (marking) return <MarkCheck owned={state.owned} />
  if (state.owned) return null
  const w = state.available[0]
  return (
    <>
      {w ? <ChannelBadge channel={w.channel} /> : null}
      {state.voucher ? <VoucherMark /> : null}
    </>
  )
})

export const SkinTip = memo(
  ({
    state,
    character,
    marking,
    now,
  }: {
    state: SkinState
    character: Character | undefined
    marking: boolean
    now: number
  }) => {
    const w = state.owned ? undefined : state.available[0]
    return (
      <div className="cpp-skins-tip">
        <b>{state.skin.name}</b>
        <div className="cpp-skins-muted">{skinSubtitle(state, character)}</div>
        <div className={w ? `cpp-skins-way cpp-skins-tone-${channelTone(w.channel)}` : 'cpp-skins-muted'}>
          {w ? <Icon icon={channelIcons[w.channel]} size={12} /> : null}
          {stateText(state, now)}
        </div>
        {state.voucher ? <div className="cpp-skins-tip-voucher">{gt.pgettext('skins', '可用时装自选凭证')}</div> : null}
        <div className="cpp-skins-muted">
          {marking ? gt.pgettext('skins', '点击切换已有 / 缺') : gt.pgettext('skins', '点击打开干员档案')}
        </div>
      </div>
    )
  },
)

export const onButtonKey = (e: React.KeyboardEvent<HTMLElement>) => {
  if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return
  e.preventDefault()
  e.currentTarget.click()
}

/** 品牌墙上的 40px 头像：悬停看说明，点一下打开档案（标记中是切换） */
export const SkinTile = memo(
  ({
    state,
    character,
    marking,
    now,
    onActivate,
  }: {
    state: SkinState
    character: Character | undefined
    marking: boolean
    now: number
    onActivate: (state: SkinState) => void
  }) => (
    <Tooltip
      content={<SkinTip state={state} character={character} marking={marking} now={now} />}
      placement="right"
      hoverOpenDelay={250}
      className="cpp-skins-tile-wrap"
    >
      <span
        role="button"
        tabIndex={0}
        aria-pressed={marking ? state.owned : undefined}
        aria-label={`${state.skin.name}，${skinSubtitle(state, character)}，${stateText(state, now)}`}
        className={'cpp-skins-tile' + (state.owned ? '' : ' is-missing')}
        onClick={() => onActivate(state)}
        onKeyDown={onButtonKey}
      >
        <SkinPicture id={state.skin.id} kind="avatar" name={state.skin.name} />
        <SkinMarks state={state} marking={marking} />
      </span>
    </Tooltip>
  ),
)
