import { TextArea } from '@blueprintjs/core'
import { memo, useState } from 'react'
import { QueryParam } from '../../pkg/cpp-basic'
import { gt } from '../../pkg/gt'
import { locateJsonError } from './jsonError'
import { useDebouncedCommit } from './useDebouncedCommit'

export function describeJsonError(text: string, e: unknown): string {
  const message = (e as Error)?.message ?? String(e)
  const pos = locateJsonError(text, message)
  if (!pos) return message
  // 位置已经单独写出，消息里的重复部分去掉
  const detail = message
    .replace(/\s*\(line \d+ column \d+\)/, '')
    .replace(/ in JSON at position \d+/, '')
    .replace(/ at line \d+ column \d+ of the JSON data/, '')
  return gt
    .pgettext('query editor', '第 %1 行第 %2 列：%3')
    .replace('%1', String(pos.line))
    .replace('%2', String(pos.column))
    .replace('%3', detail)
}

export const JsonEditor = memo(
  ({
    initialText,
    invalid,
    onApply,
    onParseError,
  }: {
    /** 只在挂载时读取；切换模式时组件重建，文本从当前查询重新生成 */
    initialText: string
    invalid: boolean
    onApply: (q: QueryParam) => void
    onParseError: (message: string) => void
  }) => {
    // 解析失败的文本不会写进查询，所以文本框自己保留它
    const [text, setText] = useState(initialText)
    const input = useDebouncedCommit(text, (text) => {
      setText(text)
      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch (e) {
        onParseError(describeJsonError(text, e))
        return
      }
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        onParseError(gt.pgettext('query editor', '查询必须是一个 JSON 对象。'))
        return
      }
      onApply(parsed as QueryParam)
    })

    return (
      <TextArea
        className="cpp-qe-json"
        intent={invalid ? 'danger' : 'none'}
        aria-label={gt.pgettext('query editor', '查询 JSON')}
        aria-invalid={invalid}
        fill={true}
        value={input.value}
        onChange={(e) => input.onChange(e.currentTarget.value)}
        onFocus={input.onFocus}
        onBlur={input.onBlur}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
      />
    )
  },
)
