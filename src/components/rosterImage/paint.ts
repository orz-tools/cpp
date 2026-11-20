import type { ImageLookup } from './images'
import { AREA_CAPS, pngPixels, pngScale } from './layout'
import {
  Scene,
  SceneNode,
  SvgEmbed,
  SvgEmbedder,
  collectSceneImages,
  imageKey,
  sceneFont,
  sceneOverhang,
} from './scene'

type Ctx = CanvasRenderingContext2D

/** 半透明的组先画到一张小 canvas 上，四边至少留这么多，子元素超出组的框一点（例如潜能角标的黑影）也不裁掉；带影子的框按 sceneOverhang 留得更多 */
const GROUP_PAD = 4

function releaseCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 0
  canvas.height = 0
}

function drawNodes(ctx: Ctx, nodes: readonly SceneNode[], images: ImageLookup, scale: number) {
  for (const node of nodes) {
    switch (node.kind) {
      case 'rect':
        if (node.shadow) {
          ctx.save()
          // shadowBlur 和 CSS 的模糊半径一样是标准差的两倍；它和两个偏移都按设备像素算，不跟 ctx.scale 走
          ctx.shadowColor = node.shadow.color
          ctx.shadowOffsetX = node.shadow.dx * scale
          ctx.shadowOffsetY = node.shadow.dy * scale
          ctx.shadowBlur = node.shadow.blur * scale
        }
        ctx.fillStyle = node.fill
        ctx.fillRect(node.x, node.y, node.w, node.h)
        if (node.shadow) ctx.restore()
        break
      case 'image': {
        const img = images(node.image)
        if (!img) break
        ctx.save()
        if (node.opacity != null) ctx.globalAlpha *= node.opacity
        const draw = () => {
          if (node.fit === 'cover') {
            const box = node.w / node.h
            const own = img.width / img.height
            const sw = own > box ? img.height * box : img.width
            const sh = own > box ? img.height : img.width / box
            ctx.drawImage(
              img.source,
              (img.width - sw) / 2,
              (img.height - sh) / 2,
              sw,
              sh,
              node.x,
              node.y,
              node.w,
              node.h,
            )
          } else {
            ctx.drawImage(img.source, node.x, node.y, node.w, node.h)
          }
        }
        if (node.glow) {
          // 列表是两层 drop-shadow(0 0 1px #000)；shadowBlur 按设备像素算，不跟 ctx.scale 走
          ctx.shadowColor = '#000'
          ctx.shadowBlur = scale
          draw()
        }
        draw()
        ctx.restore()
        break
      }
      case 'text':
        ctx.font = sceneFont(node)
        ctx.fillStyle = node.fill
        ctx.textAlign = node.anchor === 'middle' ? 'center' : node.anchor === 'end' ? 'right' : 'left'
        ctx.textBaseline = 'alphabetic'
        ctx.fillText(node.text, node.x, node.y)
        break
      case 'path':
        ctx.save()
        ctx.translate(node.x, node.y)
        ctx.fillStyle = node.fill
        ctx.fill(new Path2D(node.d))
        ctx.restore()
        break
      case 'group': {
        const clip = (c: Ctx) => {
          if (!node.clip) return
          c.beginPath()
          c.rect(0, 0, node.w, node.h)
          c.clip()
        }
        if (node.opacity == null || node.opacity >= 1) {
          ctx.save()
          ctx.translate(node.x, node.y)
          clip(ctx)
          drawNodes(ctx, node.children, images, scale)
          ctx.restore()
          break
        }
        // 整组合成：先画好整组，再按透明度贴上去，和 SVG 的 <g opacity> 一样
        const pad = node.clip ? GROUP_PAD : Math.max(GROUP_PAD, Math.ceil(sceneOverhang(node.children)))
        const layer = document.createElement('canvas')
        layer.width = Math.ceil((node.w + pad * 2) * scale)
        layer.height = Math.ceil((node.h + pad * 2) * scale)
        const lctx = layer.getContext('2d')
        if (!lctx) break
        lctx.imageSmoothingEnabled = true
        lctx.imageSmoothingQuality = 'high'
        lctx.scale(scale, scale)
        lctx.translate(pad, pad)
        clip(lctx)
        drawNodes(lctx, node.children, images, scale)
        ctx.save()
        ctx.globalAlpha *= node.opacity
        ctx.drawImage(layer, node.x - pad, node.y - pad, layer.width / scale, layer.height / scale)
        ctx.restore()
        releaseCanvas(layer)
        break
      }
    }
  }
}

export function paintScene(ctx: Ctx, scene: Scene, images: ImageLookup, scale: number): void {
  ctx.save()
  ctx.fillStyle = scene.background
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  ctx.scale(scale, scale)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  drawNodes(ctx, scene.nodes, images, scale)
  ctx.restore()
}

/** 建好的 canvas 不一定能用：超过上限时有的浏览器照样给，画上去却什么也没有。在右下角画一个点再读回来 */
function probe(ctx: Ctx, width: number, height: number): boolean {
  try {
    ctx.fillStyle = 'rgb(1, 2, 3)'
    ctx.fillRect(width - 1, height - 1, 1, 1)
    const [r, g, b, a] = ctx.getImageData(width - 1, height - 1, 1, 1).data
    ctx.clearRect(width - 1, height - 1, 1, 1)
    return r === 1 && g === 2 && b === 3 && a === 255
  } catch {
    return false
  }
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob(resolve, 'image/png')
    } catch {
      resolve(null)
    }
  })
}

export interface RenderedPng {
  blob: Blob
  scale: number
  width: number
  height: number
}

/** 先按大的面积上限试，建不起来或探测不过就放掉那张 canvas，按下一个再试；都不行返回 null */
export async function renderPng(scene: Scene, images: ImageLookup): Promise<RenderedPng | null> {
  for (const cap of AREA_CAPS) {
    const scale = pngScale(scene.width, scene.height, cap)
    const { width, height } = pngPixels(scene.width, scene.height, scale)
    const canvas = document.createElement('canvas')
    try {
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx || !probe(ctx, width, height)) continue
      paintScene(ctx, scene, images, scale)
      const blob = await toBlob(canvas)
      if (blob) return { blob, scale, width, height }
    } catch {
      // 换下一个上限
    } finally {
      releaseCanvas(canvas)
    }
  }
  return null
}

/** SVG 里嵌的图：图里画得最大的尺寸的 2 倍，不超过原图；去色的已经在 images 里 */
export function svgEmbed(scene: Scene, images: ImageLookup): SvgEmbedder {
  const embeds = new Map<string, SvgEmbed>()
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  for (const use of collectSceneImages(scene)) {
    const img = images(use.image)
    if (!img || !ctx) continue
    // 按原图的比例缩：cover 的那张靠原图的比例裁
    const factor = Math.min(1, Math.max((use.width * 2) / img.width, (use.height * 2) / img.height))
    const width = Math.max(1, Math.round(img.width * factor))
    const height = Math.max(1, Math.round(img.height * factor))
    canvas.width = width
    canvas.height = height
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.clearRect(0, 0, width, height)
    ctx.drawImage(img.source, 0, 0, width, height)
    embeds.set(use.key, { href: canvas.toDataURL('image/png'), width, height })
  }
  releaseCanvas(canvas)
  return (image) => embeds.get(imageKey(image))
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'))
    reader.readAsDataURL(blob)
  })
}
