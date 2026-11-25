import { memo, useId } from 'react'
import { setPotential } from '../../../pkg/cpp-arknights/statusEdit'
import { gt } from '../../../pkg/gt'
import { PotentialIcon } from '../Icons'
import { DetailToggle } from './Detail'
import { PotentialDetail } from './PotentialDetail'
import { Section } from './Section'
import { StepGroup } from './StepGroup'
import { useEditor } from './context'
import { potentialText } from './text'

const POTENTIALS = [1, 2, 3, 4, 5, 6]

/** Only in the current status: potential costs tokens, not materials, so there is nothing to plan. */
export const PotentialSection = memo(() => {
  const { status, setStatus, openDetail } = useEditor()
  const labelId = useId()
  const panelId = useId()
  const rank = status.potentialRank || 0
  const title = gt.pgettext('arknights status group', '潜能')

  return (
    <Section title={title}>
      <div className="cpp-charstat-row">
        <div className="cpp-charstat-lbl">
          <span className="cpp-charstat-potential">
            <PotentialIcon potentialRank={rank} />
          </span>
          <span id={labelId}>{title}</span>
          <DetailToggle id="potential" panelId={panelId} name={title} />
        </div>
        <StepGroup
          labelledBy={labelId}
          values={POTENTIALS}
          value={rank + 1}
          label={potentialText}
          onPick={(v) => setStatus((x) => setPotential(x, v - 1))}
        />
      </div>
      {openDetail === 'potential' ? <PotentialDetail panelId={panelId} /> : null}
    </Section>
  )
})
