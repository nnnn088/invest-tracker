import { toPng } from 'html-to-image'

const isSafari = () => /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent)

/** 等两帧，让刚挂载的元素（含图表画布）完成布局和绘制 */
const nextFrames = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

/** 把汇报视图渲染成 3 倍像素比的 PNG（data URL），全程在本地完成 */
export async function renderPng(node: HTMLElement): Promise<string> {
  await nextFrames()
  if ('fonts' in document) await document.fonts.ready
  // 平台图标等图片必须加载完，否则会被漏掉
  await Promise.all(
    [...node.querySelectorAll('img')].map((img) =>
      img.complete ? Promise.resolve() : new Promise<void>((r) => { img.onload = img.onerror = () => r() }),
    ),
  )
  const opts = { pixelRatio: 3, cacheBust: true, backgroundColor: getComputedStyle(node).backgroundColor }
  // Safari 第一次转换常常丢图片和字体，先预热一次
  if (isSafari()) await toPng(node, opts).catch(() => undefined)
  return toPng(node, opts)
}

/** iPhone / iPad（含请求桌面版网站的 iPadOS）：主屏幕模式下普通下载链接不可靠 */
export const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

/** 触发浏览器下载 */
export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export async function dataUrlToBlob(url: string): Promise<Blob> {
  return (await fetch(url)).blob()
}

/** 调用系统分享面板（带文件）；不支持时返回 'unsupported'，由界面给出提示 */
export async function shareImageFile(blob: Blob, name: string, title: string): Promise<'shared' | 'cancelled' | 'unsupported'> {
  const file = new File([blob], name, { type: 'image/png' })
  if (typeof navigator.canShare !== 'function' || !navigator.canShare({ files: [file] })) return 'unsupported'
  try {
    await navigator.share({ files: [file], title })
    return 'shared'
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
    return 'unsupported'
  }
}
