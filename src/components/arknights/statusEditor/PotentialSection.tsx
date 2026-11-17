import { memo, useId } from 'react'
import { setPotential } from '../../../pkg/cpp-arknights/statusEdit'
import { gt } from '../../../pkg/gt'
import { PotentialIcon } from '../Icons'
import { Section } from './SectionHeader'
import { StepGroup } from './StepGroup'
import { useEditor } from './context'

const POTENTIALS = [1, 2, 3, 4, 5, 6]

function potentialText(potential: number) {
  return gt
    .gettext('潜能 %d') /* I10N: %d: potential, 1-6 */
    .replaceAll('%d', `${potential}`)
}

/** Only in the current status: potential costs tokens, not materials, so there is nothing to plan. */
export const PotentialSection = memo(() => {
  const { status, setStatus } = useEditor()
  const titleId = useId()
  const rank = status.potentialRank || 0

  return (
    <Section id={titleId} title={gt.pgettext('arknights status group', '潜能')} summary={potentialText(rank + 1)}>
      <div className="cpp-charstat-row">
        <div className="cpp-charstat-lbl">
          <span className="cpp-charstat-potential">
            <PotentialIcon potentialRank={rank} />
          </span>
        </div>
        <StepGroup
          labelledBy={titleId}
          values={POTENTIALS}
          value={rank + 1}
          label={potentialText}
          onPick={(v) => setStatus((x) => setPotential(x, v - 1))}
        />
      </div>
    </Section>
  )
})
