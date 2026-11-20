import type { BlobImages } from '../../pkg/blobcache'

/** asset 是打包进来的图（Vite 给的 URL）；blob 走 blobcache，和列表同一个 flavour */
export type SceneImage = ({ asset: string } | { blob: BlobImages }) & { grayscale?: boolean }

export type SceneFit = 'fill' | 'cover'

/** 照 CSS 的 box-shadow 写：blur 是 CSS 的模糊半径，是标准差的两倍 */
export interface SceneShadow {
  dx: number
  dy: number
  blur: number
  color: string
}

/** 影子伸出框外最远多少：高斯模糊到 3 个标准差就看不出了 */
export function shadowReach(shadow: SceneShadow): number {
  return Math.max(Math.abs(shadow.dx), Math.abs(shadow.dy)) + shadow.blur * 1.5
}

/** 坐标都是 1 倍 px；group 的子元素相对它的左上角；文字的 y 是基线 */
export type SceneNode =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; fill: string; shadow?: SceneShadow }
  | {
      kind: 'image'
      x: number
      y: number
      w: number
      h: number
      image: SceneImage
      /** cover：铺满，裁掉多出来的 */
      fit?: SceneFit
      opacity?: number
      /** 列表潜能角标那圈 1px 的黑影 */
      glow?: boolean
    }
  | {
      kind: 'text'
      x: number
      y: number
      text: string
      size: number
      fill: string
      bold?: boolean
      mono?: boolean
      anchor?: 'start' | 'middle' | 'end'
    }
  /** d 只用 M、h、v、z，整条填满：二维码一次填完，小数倍缩放时格子之间没有细缝 */
  | { kind: 'path'; x: number; y: number; d: string; fill: string }
  /** opacity 是整组画好以后再贴上去，和 SVG 的 <g opacity> 一样；逐个乘的话深灰底上的图标会透出底色 */
  | {
      kind: 'group'
      x: number
      y: number
      w: number
      h: number
      opacity?: number
      clip?: boolean
      children: SceneNode[]
    }

export interface Scene {
  width: number
  height: number
  background: string
  nodes: SceneNode[]
}

/** 游戏自己的一个开关，对话框里一个勾选框 */
export interface RosterImageToggle {
  key: string
  label: string
  /** 画法现在用的值：对话框里改过的，没改过就是游戏自己的设置 */
  value: boolean
}

/** 对话框里改过的开关，按 key；没改过的不在里面 */
export type RosterToggleValues = Readonly<Partial<Record<string, boolean>>>

/** 练度图里游戏给的画法；外壳排版，画名字、标题和页脚 */
export interface RosterImagePainter {
  /** 练度格的宽、高；每名干员一样大，列才对得齐 */
  statusWidth: number
  statusHeight: number
  toggles?: readonly RosterImageToggle[]
  /** 40×40 的头像，原点在左上角；absent 是未持有 */
  avatar: (character: any, status: any, absent: boolean) => SceneNode[]
  /** 一格练度，原点在左上角；给了 current 时，和它相同的部分画淡，像列表的目标格 */
  status: (status: any, character: any, current?: any) => SceneNode[]
}

export const SANS_FONT =
  "'Source Han Sans SC', Inter, system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', 'Noto Sans CJK SC', sans-serif"
export const MONO_FONT = 'ui-monospace, Menlo, Consolas, monospace'

/** canvas 的 font 简写和 measureText 用的同一串 */
export function sceneFont(node: { size: number; bold?: boolean; mono?: boolean }): string {
  return `${node.bold ? 'bold ' : ''}${node.size}px ${node.mono ? MONO_FONT : SANS_FONT}`
}

/** 图源加去色：两个出口都按它认图，同一张图只载入、只嵌一次 */
export function imageKey(image: SceneImage): string {
  const source = 'asset' in image ? { asset: image.asset } : { blob: image.blob }
  return JSON.stringify([source, !!image.grayscale])
}

export interface SceneImageUse {
  key: string
  image: SceneImage
  /** 图里画得最大的宽、高，分开取 */
  width: number
  height: number
  fits: SceneFit[]
}

export function walkScene(nodes: readonly SceneNode[], visit: (node: SceneNode) => void): void {
  for (const node of nodes) {
    visit(node)
    if (node.kind === 'group') walkScene(node.children, visit)
  }
}

/** 这些节点的影子最远伸出它们自己的框多少；裁切的组不往外画 */
export function sceneOverhang(nodes: readonly SceneNode[]): number {
  let reach = 0
  for (const node of nodes) {
    if (node.kind === 'rect' && node.shadow) reach = Math.max(reach, shadowReach(node.shadow))
    else if (node.kind === 'group' && !node.clip) reach = Math.max(reach, sceneOverhang(node.children))
  }
  return reach
}

export function collectSceneImages(scene: Scene): SceneImageUse[] {
  const uses = new Map<string, SceneImageUse>()
  walkScene(scene.nodes, (node) => {
    if (node.kind !== 'image') return
    const key = imageKey(node.image)
    const fit = node.fit ?? 'fill'
    const use = uses.get(key)
    if (!use) {
      uses.set(key, { key, image: node.image, width: node.w, height: node.h, fits: [fit] })
      return
    }
    use.width = Math.max(use.width, node.w)
    use.height = Math.max(use.height, node.h)
    if (!use.fits.includes(fit)) use.fits.push(fit)
  })
  return [...uses.values()]
}

export interface SvgEmbed {
  /** data URL */
  href: string
  width: number
  height: number
}

/** 嵌进 SVG 的图；没载入的返回 undefined，用到它的地方不画 */
export type SvgEmbedder = (image: SceneImage) => SvgEmbed | undefined

function num(n: number): string {
  return String(Math.round(n * 1000) / 1000)
}

export function escapeXml(text: string): string {
  return text.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&apos;',
  )
}

const GLOW_FILTER_ID = 'cpp-glow'

/**
 * 纯 SVG：嵌的图在 <defs> 里各一个 <symbol>，用到的地方写 <use>。
 * 用 xlink:href 而不是 href：只认 SVG 1.1 的看图软件也打得开
 */
export function sceneToSvg(scene: Scene, embed: SvgEmbedder): string {
  const symbols = new Map<string, string>()
  const defs: string[] = []
  const shadowFilters = new Map<string, string>()
  let glow = false

  // 滤镜的区域默认只比框大 10%，矮的框装不下往下的影子；按框的大小各写一个
  const shadowFilter = (blur: number, w: number, h: number): string => {
    const key = `${blur}|${w}|${h}`
    let id = shadowFilters.get(key)
    if (!id) {
      id = `cpp-shadow${shadowFilters.size}`
      shadowFilters.set(key, id)
      const reach = Math.ceil(blur * 1.5) + 1
      const fx = reach / w
      const fy = reach / h
      defs.push(
        `<filter id="${id}" x="${num(-fx)}" y="${num(-fy)}" width="${num(1 + fx * 2)}" height="${num(1 + fy * 2)}">` +
          `<feGaussianBlur stdDeviation="${num(blur / 2)}"/></filter>`,
      )
    }
    return id
  }

  for (const use of collectSceneImages(scene)) {
    const data = embed(use.image)
    if (!data) continue
    for (const fit of use.fits) {
      const id = `img${defs.length}`
      symbols.set(`${use.key}|${fit}`, id)
      const aspect = fit === 'cover' ? 'xMidYMid slice' : 'none'
      defs.push(
        `<symbol id="${id}" viewBox="0 0 ${num(data.width)} ${num(data.height)}" preserveAspectRatio="${aspect}">` +
          `<image width="${num(data.width)}" height="${num(data.height)}" xlink:href="${escapeXml(data.href)}"/>` +
          `</symbol>`,
      )
    }
  }

  const render = (nodes: readonly SceneNode[]): string =>
    nodes
      .map((node) => {
        switch (node.kind) {
          case 'rect': {
            const rect = `<rect x="${num(node.x)}" y="${num(node.y)}" width="${num(node.w)}" height="${num(node.h)}" fill="${escapeXml(node.fill)}"/>`
            const { shadow } = node
            if (!shadow) return rect
            // 影子是框下面另一个模糊了的框，只用 SVG 1.1 就有的 feGaussianBlur：看图软件的滤镜出了问题，坏的也只是影子，框照画
            const id = shadowFilter(shadow.blur, node.w, node.h)
            return (
              `<rect x="${num(node.x + shadow.dx)}" y="${num(node.y + shadow.dy)}" width="${num(node.w)}" height="${num(node.h)}" ` +
              `fill="${escapeXml(shadow.color)}" filter="url(#${id})"/>${rect}`
            )
          }
          case 'image': {
            const id = symbols.get(`${imageKey(node.image)}|${node.fit ?? 'fill'}`)
            if (!id) return ''
            if (node.glow) glow = true
            const extra =
              (node.opacity != null && node.opacity !== 1 ? ` opacity="${num(node.opacity)}"` : '') +
              (node.glow ? ` filter="url(#${GLOW_FILTER_ID})"` : '')
            return `<use xlink:href="#${id}" x="${num(node.x)}" y="${num(node.y)}" width="${num(node.w)}" height="${num(node.h)}"${extra}/>`
          }
          case 'text': {
            const attrs = [
              `x="${num(node.x)}"`,
              `y="${num(node.y)}"`,
              `font-family="${escapeXml(node.mono ? MONO_FONT : SANS_FONT)}"`,
              `font-size="${num(node.size)}"`,
              ...(node.bold ? ['font-weight="bold"'] : []),
              ...(node.anchor && node.anchor !== 'start' ? [`text-anchor="${node.anchor}"`] : []),
              `fill="${escapeXml(node.fill)}"`,
            ]
            return `<text ${attrs.join(' ')}>${escapeXml(node.text)}</text>`
          }
          case 'path':
            return `<path transform="translate(${num(node.x)} ${num(node.y)})" d="${escapeXml(node.d)}" fill="${escapeXml(node.fill)}"/>`
          case 'group': {
            const opacity = node.opacity != null && node.opacity !== 1 ? ` opacity="${num(node.opacity)}"` : ''
            const inner = render(node.children)
            const body = node.clip
              ? `<svg width="${num(node.w)}" height="${num(node.h)}" overflow="hidden">${inner}</svg>`
              : inner
            return `<g transform="translate(${num(node.x)} ${num(node.y)})"${opacity}>${body}</g>`
          }
        }
      })
      .join('')

  const body = render(scene.nodes)
  if (glow) {
    // 列表是两层 drop-shadow(0 0 1px #000)：CSS 的模糊半径是标准差的两倍
    const shadow = '<feDropShadow dx="0" dy="0" stdDeviation="0.5" flood-color="#000"/>'
    defs.push(`<filter id="${GLOW_FILTER_ID}" x="-50%" y="-50%" width="200%" height="200%">${shadow}${shadow}</filter>`)
  }

  const { width, height } = scene
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `width="${num(width)}" height="${num(height)}" viewBox="0 0 ${num(width)} ${num(height)}">` +
    (defs.length ? `<defs>${defs.join('')}</defs>` : '') +
    `<rect x="0" y="0" width="${num(width)}" height="${num(height)}" fill="${escapeXml(scene.background)}"/>` +
    body +
    `</svg>`
  )
}
