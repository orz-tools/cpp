import { describe, expect, it } from 'vitest'
import { FARM_FAILURE_TOKEN, FarmFailure } from '../pkg/cpp-basic/farmFailure'
import { farmFailureIssueBlock, farmFailureIssueUrl } from './farmFailureIssue'

const failure: FarmFailure = {
  at: '2026-11-20T00:00:00.000Z',
  game: 'arknights',
  region: 'zh_CN',
  build: '8da56807b076fca4713eaad031e4185e2d7adf71',
  solver: { version: '1.0.3', precision: 1e-9 },
  data: {},
  level: 'goal_for_finished',
  failed: 'Finished',
  forbiddenStageIds: [],
  forbiddenFormulaTags: [],
  outcome: { feasible: false, bounded: true, result: 0 },
  model: { optimize: 'ap', opType: 'min', constraints: {}, variables: {} },
}

describe('farmFailureIssueUrl', () => {
  it('fills in the issue form with what the failure says about itself', () => {
    const url = new URL(farmFailureIssueUrl(failure, '计划 (以毕业为目标)'))
    expect(url.origin + url.pathname).toBe('https://github.com/orz-tools/cpp/issues/new')
    expect(url.searchParams.get('title')).toBe('刷图规划求解失败')
    const body = url.searchParams.get('body')!
    expect(body).toContain('- 刷图层级：计划 (以毕业为目标)')
    expect(body).toContain('- 区服：zh_CN')
    expect(body).toContain('- 构建：8da56807b076fca4713eaad031e4185e2d7adf71')
    expect(body).not.toContain('求解器出错')
    expect(body).not.toContain(FARM_FAILURE_TOKEN)
  })

  it('names the error the solver threw by its first line, and stays short', () => {
    const stack = 'Error: forced\n' + '    at somewhere (https://example.com/assets/index.js:1:2)\n'.repeat(200)
    const url = farmFailureIssueUrl({ ...failure, outcome: { error: stack } }, '计划 (以毕业为目标)')
    expect(new URL(url).searchParams.get('body')).toContain('- 求解器出错：Error: forced\n')
    expect(url.length).toBeLessThan(2000)
  })
})

describe('farmFailureIssueBlock', () => {
  it('folds the data into a code block', () => {
    expect(farmFailureIssueBlock('cpp-farm:AAAA')).toBe(
      '<details><summary>求解数据</summary>\n\n```\ncpp-farm:AAAA\n```\n\n</details>\n',
    )
  })
})
