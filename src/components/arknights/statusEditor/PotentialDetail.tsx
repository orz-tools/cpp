import { Icon } from '@blueprintjs/core'
import { Fragment, memo } from 'react'
import { ProfessionNames } from '../../../pkg/cpp-arknights'
import { getPotentialDetail } from '../../../pkg/cpp-arknights/details'
import { potentialReached, potentialSteps } from '../../../pkg/cpp-arknights/potentials'
import { PSTR, gt } from '../../../pkg/gt'
import { ProfessionIcon } from '../Icons'
import { DetailPanel, RichText } from './Detail'
import { useEditor } from './context'
import { potentialText } from './text'

/**
 * The 潜能 row's (i): what 潜能 2–6 each give, ticked up to the current potential and gray above it, with the talent
 * texts a potential changes. Amiya's professions each have their own potentials, listed one after another.
 */
export const PotentialDetail = memo(({ panelId }: { panelId: string }) => {
  const { character, status, dm } = useEditor()
  const rank = status.potentialRank || 0

  return (
    <DetailPanel dm={dm} id={panelId} missing={gt.pgettext('arknights status editor', '还没有这名干员的潜能数据')}>
      {(details) => {
        const forms = character.charIds.flatMap((charId) => {
          const detail = getPotentialDetail(details, charId)
          return detail ? [{ charId, detail }] : []
        })
        if (!forms.length) return null
        if (forms.every((f) => !f.detail.ranks.length)) {
          return (
            <div className="cpp-charstat-det-missing">
              {gt.pgettext('arknights status editor', '这名干员不能提升潜能')}
            </div>
          )
        }
        const labelled = character.hasPatches && forms.length > 1
        const lists = forms
          .filter((f) => f.detail.ranks.length)
          .map((f) => ({ charId: f.charId, steps: potentialSteps(f.detail) }))
        return (
          <>
            {lists.some((l) => l.steps.some((s) => s.talents.length)) ? (
              <div className="cpp-charstat-det-meta">
                {gt.pgettext('arknights status editor', '天赋的数值按满级、不装模组计')}
              </div>
            ) : null}
            {lists.map(({ charId, steps }) => {
              const profession = character.getPatchProfession(charId)
              return (
                <div key={charId} className="cpp-charstat-pot-form">
                  {labelled ? (
                    <div className="cpp-charstat-pot-prof">
                      <ProfessionIcon profession={profession} />
                      {(ProfessionNames as Partial<Record<string, PSTR>>)[profession]?.toString()}
                    </div>
                  ) : null}
                  <div className="cpp-charstat-pot-grid">
                    {steps.map((step) => {
                      const reached = potentialReached(rank, step.potential)
                      const dim = reached ? '' : ' cpp-charstat-det-dim'
                      return (
                        <Fragment key={step.potential}>
                          <span className={'cpp-charstat-pot-mark' + dim}>
                            {reached ? (
                              <Icon
                                icon="small-tick"
                                size={14}
                                title={gt.pgettext('arknights status editor', '已有')}
                              />
                            ) : null}
                          </span>
                          <span className={'cpp-charstat-pot-n' + dim}>{potentialText(step.potential)}</span>
                          <div className={'cpp-charstat-pot-text' + dim}>
                            {step.text}
                            {step.talents.map((t, i) => (
                              <span key={i} className="cpp-charstat-pot-talent">
                                <b>{t.name}</b>
                                {t.segments ? (
                                  <>
                                    {
                                      gt.pgettext(
                                        'arknights status editor',
                                        '：',
                                      ) /* I10N: between a talent's name and its text */
                                    }
                                    <RichText segments={t.segments} details={details} />
                                  </>
                                ) : null}
                              </span>
                            ))}
                          </div>
                        </Fragment>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </>
        )
      }}
    </DetailPanel>
  )
})
