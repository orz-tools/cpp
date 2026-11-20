import { AnchorButton, Button, Classes, NonIdealState, TextArea } from '@blueprintjs/core'
import { memo } from 'react'
import { FarmLevel, FarmLevelNames } from '../Cpp'
import { gt } from '../pkg/gt'
import { externalLinkProps } from './AboutList'
import { farmFailureIssueBlock, farmFailureIssueUrl } from './farmFailureIssue'
import type { PlanFailed } from './FarmList'
import { AppToaster } from './Toaster'

/**
 * Called from the click itself, before anything is awaited: Safari only lets the clipboard be written while the click
 * is still being handled.
 */
function copy(text: string, done: string) {
  void navigator.clipboard.writeText(text).then(
    () => AppToaster.then((t) => t.show({ icon: 'tick', intent: 'success', message: done })),
    () =>
      AppToaster.then((t) =>
        t.show({
          icon: 'error',
          intent: 'danger',
          message: gt.gettext('无法写入剪贴板，请在文本框里全选后复制。'),
        }),
      ),
  )
}

/** 线性规划失败, with the solver's data for the user to pass on */
export const FarmFailureState = memo(({ failed }: { failed: PlanFailed }) => {
  const { failure, text } = failed
  return (
    <NonIdealState
      icon="error"
      title={gt.gettext('线性规划失败')}
      className="cpp-farm-failure"
      description={
        <>
          <p>{gt.gettext('可以复制下面的求解数据发给开发者，或者在 GitHub 上报告，帮助我们找出原因。')}</p>
          <TextArea
            readOnly
            fill
            rows={3}
            size="small"
            value={text}
            spellCheck={false}
            className="cpp-farm-failure-data"
            aria-label={gt.gettext('求解数据')}
            onFocus={(e) => e.currentTarget.select()}
          />
          <p className={Classes.TEXT_MUTED}>
            {gt.gettext(
              '求解数据里有这次规划用到的材料需求和库存数量，没有档案名和干员信息。在 GitHub 上报告会公开这些内容。',
            )}
          </p>
        </>
      }
      action={
        <div className="cpp-farm-failure-actions">
          <Button
            icon="clipboard"
            text={gt.gettext('复制求解数据')}
            onClick={() => copy(text, gt.gettext('已复制求解数据'))}
          />
          <AnchorButton
            icon="git-repo"
            text={gt.gettext('在 GitHub 上报告')}
            href={farmFailureIssueUrl(failure, FarmLevelNames[failure.level as FarmLevel].toString())}
            {...externalLinkProps}
            onClick={() => copy(farmFailureIssueBlock(text), gt.gettext('已复制求解数据，请粘贴到 GitHub 的问题里'))}
          />
        </div>
      }
    />
  )
})
