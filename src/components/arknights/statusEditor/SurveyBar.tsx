import { Button, Icon, SegmentedControl, Tooltip } from '@blueprintjs/core'
import { memo, useId } from 'react'
import { ArknightsDataManager, SurveySourceKey } from '../../../pkg/cpp-arknights'
import { HeyboxSurveySource, YituliuSurveySource } from '../../../pkg/cpp-arknights/survey'
import { gt } from '../../../pkg/gt'
import { useMissingData } from '../../MissingData'
import { statTooltip } from './SurveyStat'
import { useEditor } from './context'
import { percentText } from './text'

/** The data container behind the statistics chosen; null for 不显示 */
export function surveyContainer(dm: ArknightsDataManager, source: SurveySourceKey) {
  if (source === SurveySourceKey.Yituliu) return dm.$surveyYituliu
  if (source === SurveySourceKey.Heybox) return dm.$surveyHeybox
  return null
}

/** Which community statistics to show under the cells, and the operator's ownership rate in them. */
export const SurveyBar = memo(
  ({ source, setSource }: { source: SurveySourceKey; setSource: (x: SurveySourceKey) => void }) => {
    const { survey, surveyName, character, dm } = useEditor()
    const { missing, loading, retry } = useMissingData(surveyContainer(dm, source))
    const labelId = useId()
    const own = survey?.own(character)

    return (
      <div className="cpp-charstat-bar">
        <div className="cpp-charstat-bar-source" role="group" aria-labelledby={labelId}>
          <span id={labelId}>{gt.pgettext('arknights status editor', '统计')}</span>
          <SegmentedControl
            size="small"
            value={source}
            onValueChange={(x) => setSource(x as SurveySourceKey)}
            options={[
              { label: gt.pgettext('arknights status editor', '不显示'), value: SurveySourceKey.None },
              { label: YituliuSurveySource.VeryShortName.toString(), value: SurveySourceKey.Yituliu },
              { label: HeyboxSurveySource.VeryShortName.toString(), value: SurveySourceKey.Heybox },
            ]}
          />
        </div>
        {missing ? (
          <span className="cpp-charstat-own cpp-charstat-own-error">
            {gt.pgettext('arknights status editor', '统计载入失败')}
            <Button size="small" variant="outlined" loading={loading} onClick={retry}>
              {gt.pgettext('arknights status editor', '重试')}
            </Button>
          </span>
        ) : survey ? (
          <span className="cpp-charstat-own">
            <Icon icon="people" size={14} />
            {gt.pgettext('arknights status editor', '持有率')}
            {own && Number.isFinite(own.percent) ? (
              <Tooltip
                compact
                openOnTargetFocus={false}
                placement="top"
                hoverOpenDelay={150}
                content={statTooltip(
                  gt.pgettext('arknights status editor', '持有率'),
                  own.percent,
                  own.samples,
                  'all',
                  surveyName,
                )}
              >
                <span className="cpp-charstat-own-value">{percentText(own.percent)}</span>
              </Tooltip>
            ) : (
              <span className="cpp-charstat-own-value">—</span>
            )}
          </span>
        ) : null}
      </div>
    )
  },
)
