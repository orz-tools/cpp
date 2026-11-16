import { useCallback, useEffect, useRef, useState } from 'react'
import useEvent from 'react-use-event-hook'

/**
 * 文本框的本地值即时更新，停止输入 delay 毫秒后或失焦时才提交。
 * 编辑期间显示本地文本而不是外部值，否则提交后的规范化（如 "4." → 4）会打断输入。
 */
export function useDebouncedCommit(value: string, commit: (value: string) => void, delay = 300) {
  const [editing, setEditing] = useState<string | null>(null)
  const pending = useRef<{ value: string } | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const commitEvent = useEvent(commit)

  const flush = useCallback(() => {
    window.clearTimeout(timer.current)
    const p = pending.current
    pending.current = null
    if (p) commitEvent(p.value)
  }, [commitEvent])

  const onChange = useCallback(
    (next: string) => {
      setEditing(next)
      pending.current = { value: next }
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(flush, delay)
    },
    [delay, flush],
  )

  useEffect(() => () => window.clearTimeout(timer.current), [])

  return {
    value: editing ?? value,
    onChange,
    onFocus: useCallback(() => setEditing(value), [value]),
    onBlur: useCallback(() => {
      flush()
      setEditing(null)
    }, [flush]),
  }
}
