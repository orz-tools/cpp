import { SegmentedControl } from '@blueprintjs/core'
import { memo } from 'react'
import { gt } from '../pkg/gt'

/** 「当前状态 / 培养目标」：档案的「练度」页和列表的弹窗里，编辑器顶上的那一个 */
export const StatusModeSwitch = memo(
  ({ isGoal, onChange }: { isGoal: boolean; onChange: (isGoal: boolean) => void }) => (
    // SegmentedControl takes no aria props, so the group around it carries the name
    <div className="cpp-status-mode-switch" role="group" aria-label={gt.pgettext('status editor', '要改的练度')}>
      <SegmentedControl
        size="small"
        intent="primary"
        value={isGoal ? 'goal' : 'current'}
        options={[
          { value: 'current', label: gt.gettext('当前状态') },
          { value: 'goal', label: gt.gettext('培养目标') },
        ]}
        onValueChange={(value) => onChange(value === 'goal')}
      />
    </div>
  ),
)
