import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { Platform } from '@/data/types'

const EXTS = ['svg', 'png'] as const

/** 内置平台读取 public/icons/platforms/<id>.(svg|png)，缺失或自定义平台回退为“颜色圆底 + 首字母” */
export function PlatformBadge({ platform, className }: { platform: Platform; className?: string }) {
  const [extIndex, setExtIndex] = useState(0)
  const showImage = platform.builtin && extIndex < EXTS.length

  return (
    <span
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-semibold text-white',
        className,
      )}
      style={showImage ? undefined : { backgroundColor: platform.color }}
    >
      {showImage ? (
        <img
          src={`${import.meta.env.BASE_URL}icons/platforms/${platform.id}.${EXTS[extIndex]}`}
          alt=""
          className="size-full object-cover"
          onError={() => setExtIndex((i) => i + 1)}
        />
      ) : (
        platform.name.trim().charAt(0).toUpperCase()
      )}
    </span>
  )
}
