import React, { memo } from 'react'
import { PSTR } from '../pkg/gt'

export const LineBreaks = memo(({ strings }: { strings: string[] }) => (
  <React.Fragment>
    {strings.map((text, index) => (
      <React.Fragment key={text}>
        {!!index && <br />}
        {text}
      </React.Fragment>
    ))}
  </React.Fragment>
))

export const PSTRs = memo(({ strings }: { strings: PSTR | PSTR[] }) => {
  const str = Array.isArray(strings) ? strings : [strings]
  return <LineBreaks strings={[...new Set(str.map((x) => x.toString()))]} />
})
