import React, { memo } from 'react'
import { gt } from '../../../pkg/gt'

/** "from → to" with the target in blue, or the value alone when nothing changes. */
export const Delta = memo(({ from, to }: { from: string; to?: string }) =>
  to === undefined || to === from ? (
    <>{from}</>
  ) : (
    <>
      {from} → <b>{to}</b>
    </>
  ),
)

/** A section's title, with where it stands on the right; a goal's maxed section keeps only this line. */
export const Section = memo(
  ({
    id,
    title,
    summary,
    collapsed,
    children,
  }: {
    id: string
    title: string
    summary: React.ReactNode
    collapsed?: boolean
    children?: React.ReactNode
  }) => (
    <section className="cpp-charstat-sec" aria-labelledby={id}>
      <div className="cpp-charstat-sh">
        <h3 id={id}>{title}</h3>
        <span className="cpp-charstat-delta">
          {collapsed ? gt.pgettext('arknights status editor', '已满') : summary}
        </span>
      </div>
      {collapsed ? null : children}
    </section>
  ),
)
