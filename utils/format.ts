const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
})

export function formatShanghaiDate(value: string): string {
  return dateFormatter.format(new Date(value)).replaceAll('/', '.')
}

export function formatPeriod(start: string | null, end: string | null): string {
  if (!start && !end) return '统计周期待核验'
  if (start === end || !end) return start || end || ''
  return `${start} — ${end}`
}
