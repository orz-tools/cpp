import React, { memo } from 'react'

/** A part of the editor, ruled off from the next. Its rows say what they are, so the title is only named, not drawn. */
export const Section = memo(({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="cpp-charstat-sec" aria-label={title}>
    {children}
  </section>
))
