import { format } from 'date-fns'

/** 存成文件：建一个 <a download> 点一下；地址到下一轮事件循环再收回，不然有的浏览器还没开始下载 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** 练度图的文件名，本地时间 */
export function rosterFileName(ext: 'png' | 'svg', date: Date): string {
  return `closure-plus-plus-roster-${format(date, 'yyyyMMdd-HHmm')}.${ext}`
}
