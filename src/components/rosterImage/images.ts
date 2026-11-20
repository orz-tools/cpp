import { BlobFlavour, badUrl, load } from '../../pkg/blobcache'
import { Scene, SceneImage, collectSceneImages, imageKey } from './scene'

export interface LoadedImage {
  source: HTMLImageElement | HTMLCanvasElement
  width: number
  height: number
}

/** 对话框开着期间留着解码好的图，改设置重画时不再载入；null 是没载入 */
export type ImageCache = Map<string, Promise<LoadedImage | null>>

export type ImageLookup = (image: SceneImage) => LoadedImage | undefined

async function decode(url: string): Promise<LoadedImage | null> {
  const img = new Image()
  img.src = url
  try {
    await img.decode()
  } catch {
    return null
  }
  return img.naturalWidth > 0 ? { source: img, width: img.naturalWidth, height: img.naturalHeight } : null
}

async function loadOriginal(image: SceneImage, flavour: BlobFlavour): Promise<LoadedImage | null> {
  if ('asset' in image) return decode(image.asset)
  let url: string
  try {
    url = await load(image.blob, flavour)
  } catch {
    return null
  }
  return url === badUrl ? null : decode(url)
}

/**
 * 按 CSS grayscale(1) 的系数逐像素取亮度，和列表里没开的模组一样。
 * 不用 ctx.filter：iOS 18 以前的 Safari 不支持 canvas 的 filter
 */
function grayscale(image: LoadedImage): LoadedImage | null {
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(image.source, 0, 0)
  const data = ctx.getImageData(0, 0, image.width, image.height)
  const px = data.data
  for (let i = 0; i < px.length; i += 4) {
    const l = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]
    px[i] = px[i + 1] = px[i + 2] = l
  }
  ctx.putImageData(data, 0, 0)
  return { source: canvas, width: image.width, height: image.height }
}

function loadCached(image: SceneImage, flavour: BlobFlavour, cache: ImageCache): Promise<LoadedImage | null> {
  const key = imageKey(image)
  let pending = cache.get(key)
  if (!pending) {
    if (image.grayscale) {
      const base = { ...image, grayscale: false }
      pending = loadCached(base, flavour, cache).then((x) => (x ? grayscale(x) : null))
    } else {
      pending = loadOriginal(image, flavour)
    }
    cache.set(key, pending)
  }
  return pending
}

/** 并发载入图元里所有的图；onProgress 每载好一张报一次（n / m）。没载入的那些位置不画，计数报给对话框 */
export async function loadSceneImages(
  scene: Scene,
  flavour: BlobFlavour,
  cache: ImageCache,
  onProgress?: (done: number, total: number) => void,
): Promise<{ images: ImageLookup; missing: number }> {
  const uses = collectSceneImages(scene)
  let done = 0
  onProgress?.(0, uses.length)
  const loaded = await Promise.all(
    uses.map(async (use) => {
      const result = await loadCached(use.image, flavour, cache)
      onProgress?.(++done, uses.length)
      return [use.key, result] as const
    }),
  )
  const map = new Map<string, LoadedImage>()
  let missing = 0
  for (const [key, result] of loaded) {
    if (result) map.set(key, result)
    else missing++
  }
  return { images: (image) => map.get(imageKey(image)), missing }
}
