import { useState } from 'react'
import { useStatsStore, studyMinutesToday, entertainmentMinutesToday, topEntertainmentApps, focusScoreToday } from '@/stores/statsStore'
import { fmtMs, fmtHM } from '@/lib/format'
import { CATEGORY_META, type AppCategory } from '@/data/appClassification'
import { hasUsageAccessPermission, openUsageAccessSettings, fetchUsageStats } from '@/lib/usageStats'
import { useUserStore, currentPersona } from '@/stores/userStore'
import { useEffect } from 'react'

export default function Stats() {
  const [tab, setTab] = useState<'today' | 'trend' | 'category'>('today')
  const [hasAccess, setHasAccess] = useState(true)
  const persona = currentPersona()

  useEffect(() => {
    hasUsageAccessPermission().then(setHasAccess)
  }, [])

  if (!hasAccess) {
    return <NoAccessScreen onAuthorize={async () => {
      await openUsageAccessSettings()
      setHasAccess(await hasUsageAccessPermission())
    }} />
  }

  return (
    <div className="px-4 pt-3 pb-4">
      <h1 className="text-xl font-bold mb-3">使用时长</h1>

      {/* 切换 */}
      <div className="bg-bg-soft rounded-pill p-1 flex mb-4">
        {[
          { id: 'today', label: '今日' },
          { id: 'trend', label: '7天趋势' },
          { id: 'category', label: '分类' }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`flex-1 py-2 text-xs font-medium rounded-pill transition ${
              tab === t.id ? 'bg-white text-brand shadow' : 'text-ink-3'
            }`}
          >{t.label}</button>
        ))}
      </div>

      {tab === 'today' && <TodayView />}
      {tab === 'trend' && <TrendView />}
      {tab === 'category' && <CategoryView />}

      {/* 监工点评 */}
      <div className="card p-4 mt-4 border-l-4 border-l-brand">
        <div className="flex items-start gap-2">
          <span className="text-xl">{persona.emoji}</span>
          <div>
            <p className="text-xs text-ink-3 mb-1">{persona.name}点评</p>
            <p className="text-sm text-ink-2 leading-relaxed">
              {focusScoreToday() >= 80
                ? `今日专注度 ${focusScoreToday()}，状态很好，保持。`
                : `今日娱乐时长 ${fmtMs(entertainmentMinutesToday() * 60_000)}，超过了学习时长。${persona.catchphrases[1] || ''} 看看哪个 app 在偷你的时间。`}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function TodayView() {
  const stats = useStatsStore(s => s.todayStats)
  const sorted = [...stats].sort((a, b) => b.totalMs - a.totalMs)
  const studyTotal = studyMinutesToday()
  const entTotal = entertainmentMinutesToday()
  const pieTotal = studyTotal + entTotal

  return (
    <div className="space-y-4 animate-in">
      <div className="card p-5">
        <h3 className="font-semibold mb-3">今日时长分布</h3>
        <div className="flex items-center gap-5">
          <Donut
            size={120}
            segments={[
              { value: studyTotal, color: '#16a34a', label: '学习' },
              { value: entTotal, color: '#F43F5E', label: '娱乐' }
            ]}
            total={pieTotal}
            centerText={`${Math.round(studyMin(pieTotal))}%`}
            centerSubtext="学习占比"
          />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-green-500" />
              <span className="text-xs text-ink-2 flex-1">学习</span>
              <span className="text-sm font-medium">{fmtMs(studyTotal * 60_000)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-rose-500" />
              <span className="text-xs text-ink-2 flex-1">娱乐</span>
              <span className="text-sm font-medium">{fmtMs(entTotal * 60_000)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-semibold mb-3">所有应用 Top</h3>
        <div className="space-y-3">
          {sorted.map(s => {
            const cat = CATEGORY_META[s.category]
            return (
              <div key={s.packageName} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0"
                  style={{ background: cat.color + '14' }}>{cat.emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-ink-1 truncate">{s.label}</span>
                    <span className="text-xs text-ink-3 shrink-0">{fmtMs(s.totalMs)}</span>
                  </div>
                  <div className="h-1.5 bg-bg-soft rounded mt-1 overflow-hidden">
                    <div className="h-full rounded"
                      style={{
                        width: `${(s.totalMs / sorted[0].totalMs) * 100}%`,
                        background: cat.color
                      }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-ink-3 mt-0.5">
                    <span>{cat.label}{s.isStudy ? '·学习' : ''}</span>
                    <span>启动 {s.launchCount} 次</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function TrendView() {
  const trend = useStatsStore(s => s.weeklyTrend)
  const max = Math.max(...trend.map(t => t.studyMs + t.entertainmentMs))

  return (
    <div className="space-y-4 animate-in">
      <div className="card p-5">
        <h3 className="font-semibold mb-3">7天学习/娱乐对比</h3>
        <div className="flex items-end justify-between gap-2 h-32">
          {trend.map((t, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="flex-1 w-full flex flex-col justify-end rounded overflow-hidden bg-bg-soft">
                <div style={{ height: `${(t.studyMs / max) * 100}%`, background: '#16a34a' }} className="w-full" />
                <div style={{ height: `${(t.entertainmentMs / max) * 100}%`, background: '#F43F5E' }} className="w-full" />
              </div>
              <span className="text-[10px] text-ink-3">{t.date}</span>
              <span className="text-[10px] font-medium" style={{ color: t.focusScore >= 80 ? '#16a34a' : t.focusScore >= 60 ? '#f59e0b' : '#F43F5E' }}>{t.focusScore}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-4 mt-3 text-[10px] text-ink-3">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-green-500" />学习</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-rose-500" />娱乐</span>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-semibold mb-3">24h 专注度曲线</h3>
        <FocusCurve />
      </div>
    </div>
  )
}

function CategoryView() {
  const stats = useStatsStore(s => s.todayStats)
  const byCat: Record<AppCategory, number> = {
    study: 0, social: 0, game: 0, video: 0, other: 0
  }
  stats.forEach(s => byCat[s.category] += s.totalMs)
  const total = Object.values(byCat).reduce((a, b) => a + b, 0)
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]) as [AppCategory, number][]

  return (
    <div className="space-y-4 animate-in">
      <div className="card p-5">
        <h3 className="font-semibold mb-3">按类别</h3>
        <div className="space-y-3">
          {cats.map(([cat, ms]) => {
            const meta = CATEGORY_META[cat]
            const pct = total ? Math.round((ms / total) * 100) : 0
            return (
              <div key={cat}>
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-sm"><span className="mr-1">{meta.emoji}</span>{meta.label}</span>
                  <span className="text-xs text-ink-3">{fmtMs(ms)} · {pct}%</span>
                </div>
                <div className="h-2 bg-bg-soft rounded overflow-hidden">
                  <div className="h-full" style={{ width: `${pct}%`, background: meta.color }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-semibold mb-3">娱乐黑洞 Top3</h3>
        <div className="space-y-3">
          {topEntertainmentApps(3).map((s, i) => (
            <div key={s.packageName} className="flex items-start gap-3">
              <span className="text-base font-bold text-rose-500">#{i + 1}</span>
              <div className="flex-1">
                <div className="flex justify-between">
                  <span className="text-sm">{s.label}</span>
                  <span className="text-xs text-ink-3">{fmtMs(s.totalMs)}</span>
                </div>
                <p className="text-[11px] text-ink-3 mt-0.5 leading-relaxed">
                  启动 {s.launchCount} 次 · 最近 {Math.round((Date.now() - s.lastTimeUsed) / 60_000)} 分钟前
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function FocusCurve() {
  const curve = useStatsStore(s => s.focusCurve)
  const currentH = new Date().getHours()
  return (
    <div>
      <svg viewBox="0 0 240 100" className="w-full h-24">
        <polyline
          fill="none" stroke="#2454FF" strokeWidth="2" strokeLinecap="round"
          points={curve.map((v, i) => `${(i / 23) * 240},${100 - v}`).join(' ')}
        />
        <polyline
          fill="rgba(36,84,255,0.12)" strokeWidth="0"
          points={`0,100 ${curve.map((v, i) => `${(i / 23) * 240},${100 - v}`).join(' ')} 240,100`}
        />
        <line x1={(currentH / 23) * 240} y1="0" x2={(currentH / 23) * 240} y2="100" stroke="#F43F5E" strokeWidth="1" strokeDasharray="3 3" />
      </svg>
      <div className="flex justify-between text-[10px] text-ink-3 mt-1">
        <span>0:00</span><span>6:00</span><span>12:00</span><span>18:00</span><span>23:00</span>
      </div>
      <p className="text-xs text-ink-2 mt-2">
        你最高效的时段：<span className="text-brand font-medium">9-11 点</span>和<span className="text-brand font-medium">15-16 点</span>，重要任务请放这两个时段。
      </p>
    </div>
  )
}

function NoAccessScreen({ onAuthorize }: { onAuthorize: () => void }) {
  return (
    <div className="px-4 pt-3">
      <div className="card p-6 mt-4 text-center">
        <div className="text-5xl mb-3">🔐</div>
        <h2 className="text-lg font-semibold mb-2">需要使用情况访问权限</h2>
        <p className="text-sm text-ink-2 leading-relaxed mb-4">
          本 App 通过 Android 系统的 UsageStatsManager 获取各应用使用时长，<b>不会上传任何使用数据</b>，仅在本地分析。<br /><br />
          授权后才能：自动区分学习/娱乐 App、生成专注度曲线、找出娱乐黑洞 Top3。
        </p>
        <button className="btn-primary w-full py-3" onClick={onAuthorize}>去授权</button>
      </div>
    </div>
  )
}

function Donut({ size, segments, total, centerText, centerSubtext }: {
  size: number
  segments: { value: number; color: string; label: string }[]
  total: number
  centerText: string
  centerSubtext: string
}) {
  const r = size / 2 - 10
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r
  let offset = 0
  return (
    <svg width={size} height={size}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#EEEEEE" strokeWidth="10" />
      {segments.map((s, i) => {
        const len = (s.value / total) * circumference
        const dash = `${len} ${circumference - len}`
        const el = (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth="10"
            strokeDasharray={dash} strokeDashoffset={-offset}
            transform={`rotate(-90 ${cx} ${cy})`} />
        )
        offset += len
        return el
      })}
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize="22" fontWeight="700" fill="#1A2029">{centerText}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize="10" fill="#838A95">{centerSubtext}</text>
    </svg>
  )
}

function studyMin(total: number) {
  return (studyMinutesToday() / (total || 1)) * 100
}
