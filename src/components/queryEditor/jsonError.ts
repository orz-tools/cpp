export interface JsonErrorPosition {
  line: number
  column: number
}

/** 从 SyntaxError 消息里取出行列；Firefox 直接给行列，Chrome 给字符偏移 */
export function locateJsonError(text: string, message: string): JsonErrorPosition | undefined {
  const lc = message.match(/line (\d+) column (\d+)/)
  if (lc) return { line: Number(lc[1]), column: Number(lc[2]) }

  const pos = message.match(/position (\d+)/)
  if (pos) {
    const offset = Math.min(Number(pos[1]), text.length)
    const before = text.slice(0, offset)
    const line = before.split('\n').length
    const column = offset - before.lastIndexOf('\n')
    return { line, column }
  }

  return undefined
}
