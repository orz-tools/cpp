import type { FarmFailure } from '../pkg/cpp-basic/farmFailure'
import { gt } from '../pkg/gt'

const NEW_ISSUE_URL = 'https://github.com/orz-tools/cpp/issues/new'

/**
 * The issue form, filled in with what the failure says about itself. The solver data stays out of the address: a
 * whole stage list is tens of thousands of characters, and GitHub turns away an address past about 8 KB.
 */
export function farmFailureIssueUrl(failure: FarmFailure, levelName: string): string {
  const facts = [
    // I10N: %s: farm level, such as 计划 (以毕业为目标)
    gt.gettext('刷图层级：%s').replaceAll('%s', levelName),
    // I10N: %s: region code, such as zh_CN
    gt.gettext('区服：%s').replaceAll('%s', failure.region ?? '-'),
    // I10N: %s: the commit the app was built from
    gt.gettext('构建：%s').replaceAll('%s', failure.build ?? '-'),
    ...('error' in failure.outcome
      ? [
          // I10N: %s: the first line of the error the solver threw
          gt.gettext('求解器出错：%s').replaceAll('%s', failure.outcome.error.split('\n')[0].slice(0, 200)),
        ]
      : []),
  ]
  const body = [
    gt.gettext('刷图规划求解失败。'),
    '',
    ...facts.map((x) => '- ' + x),
    '',
    gt.gettext('请在下面粘贴求解数据（点「在 GitHub 上报告」时已复制）：'),
    '',
    '',
  ].join('\n')
  return `${NEW_ISSUE_URL}?${new URLSearchParams({ title: gt.gettext('刷图规划求解失败'), body })}`
}

/** What 在 GitHub 上报告 copies: the data folded away, so that the issue stays readable */
export function farmFailureIssueBlock(text: string): string {
  return `<details><summary>${gt.gettext('求解数据')}</summary>\n\n\`\`\`\n${text}\n\`\`\`\n\n</details>\n`
}
