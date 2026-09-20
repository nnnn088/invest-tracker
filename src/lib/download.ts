/**
 * 把文件交给用户：触屏设备优先用系统分享面板（可存到“文件”等）——
 * iOS 主屏幕模式下普通下载链接不可靠；否则走普通下载。
 */
export async function saveFile(name: string, mime: string, content: string): Promise<void> {
  const blob = new Blob([content], { type: mime })
  const file = new File([blob], name, { type: mime })

  const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
  if (touch && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name })
      return
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return // 用户取消分享
      // 其他错误退回普通下载
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
