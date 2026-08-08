/** 本地日期字符串 YYYY-MM-DD（避免 toISOString 的 UTC 时区问题） */
export function localDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 昨天的本地日期字符串 */
export function yesterdayDateStr(): string {
  return localDateStr(new Date(Date.now() - 86400000))
}
