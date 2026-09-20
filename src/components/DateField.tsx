import { useState } from 'react'
import { format, parse } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { enUS, zhCN } from 'react-day-picker/locale'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'

/** 日期选择：值为 YYYY-MM-DD 字符串 */
export function DateField({
  value,
  onChange,
  className,
}: {
  value: string
  onChange: (date: string) => void
  className?: string
}) {
  const { lang } = useI18n()
  const [open, setOpen] = useState(false)
  const selected = parse(value, 'yyyy-MM-dd', new Date())

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn('w-full justify-start font-normal', className)}>
          <CalendarIcon />
          {value}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={lang === 'zh' ? zhCN : enUS}
          selected={selected}
          defaultMonth={selected}
          onSelect={(d) => {
            if (!d) return
            onChange(format(d, 'yyyy-MM-dd'))
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
