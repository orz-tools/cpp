import { memo } from 'react'

const dots = [
  [8, 3.6],
  [3.6, 11.3],
  [12.4, 11.3],
]

/** Three dots, as many filled as the mastery. Drawn in currentColor, it reads on the blue, gray and white cells alike. */
export const MasteryGlyph = memo(({ mastery }: { mastery: number }) => (
  <svg className="cpp-charstat-mastery" viewBox="0 0 16 15" aria-hidden="true">
    {dots.map(([cx, cy], i) =>
      i < mastery ? (
        <circle key={i} cx={cx} cy={cy} r={3.1} fill="currentColor" />
      ) : (
        <circle key={i} cx={cx} cy={cy} r={2.7} fill="none" stroke="currentColor" strokeWidth={1.3} opacity={0.6} />
      ),
    )}
  </svg>
))
