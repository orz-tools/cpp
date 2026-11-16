import { decodeArkntoolsBackup } from './arkntools'
import { parseMAADepot, parseMAAOperBox } from './maa'
import { parseMaaOperProgressPlans } from './maaOperProgress'
import { parseSklandData } from './skland'

// 粘贴框按内容猜格式时用：每个函数只在文本完整地是这种格式时返回解析结果，否则返回 undefined。
// 解析函数本身为了宽容会收下别的数据，这里补上结构条件挡住误收。

function attempt<T>(parse: () => T): T | undefined {
  try {
    return parse()
  } catch {
    return undefined
  }
}

export function detectArkntoolsBackup(text: string) {
  const trimmed = text.trim()
  // 只有 base64 字符的文本才值得解码，免得把普通文字硬解出乱码
  if (!trimmed.startsWith('{') && !/^[A-Za-z0-9+/=_\-\s]+$/.test(trimmed)) return undefined
  const backup = attempt(() => decodeArkntoolsBackup(trimmed))
  // 备份的字段全是可选的，任何 JSON 对象都能通过解析
  if (!backup || (!backup.inputs && !backup.presets && !backup.planStageBlacklist)) return undefined
  return backup
}

export function detectSkland(text: string) {
  return attempt(() => parseSklandData(text))
}

export function detectMAAOperBox(text: string) {
  const opers = attempt(() => parseMAAOperBox(text))
  return opers && opers.length > 0 ? opers : undefined
}

export function detectMaaOperProgress(text: string) {
  return attempt(() => parseMaaOperProgressPlans(text))
}

// 仓库识别收得最宽：任何值是数字的对象、任何末格是数字的三列以上表格都能解析，所以要求至少认出一个道具，并且最后才试
export function detectMAADepot(text: string, isKnownItem: (itemId: string) => boolean) {
  const depot = attempt(() => parseMAADepot(text))
  return depot && Object.keys(depot).some(isKnownItem) ? depot : undefined
}
