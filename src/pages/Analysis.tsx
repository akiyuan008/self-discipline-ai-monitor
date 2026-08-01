import { useState, useEffect } from 'react'
import { useStatsStore, studyMinutesToday, entertainmentMinutesToday, focusScoreToday } from '@/stores/statsStore'
import { useUserStore, currentPersona } from '@/stores/userStore'
import { getAnalysis } from '@/lib/ai'
import { fmtMs } from '@/lib/format'
import { MOCK_SUBJECT_MONTHLY } from '@/data/mockUsage'

type Range = 'weekly' | 'monthly'

export default function Analysis() {
  const stats = useStatsStore()
  const persona = currentPersona()
  const u = useUserStore()
  const [range, setRange] = useState<Range>('weekly')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<{ summary: string; suggestions: string[] } | null>(null)

  useEffect(() => {
    let stop = false
    setLoading(true)
    const payload = {
      studyMin: studyMinutesToday(),
      entMin: entertainmentMinutesToday(),
      focus: focusScoreToday(),
      trend: stats.weeklyTrend,
      top3: stats.entertainmentTop3,
      subjects: MOCK_SUBJECT_MONTHLY
    }
    getAnalysis(range, payload).then(d => {
      if (!stop) {
        setData(d)
        setLoading(false)
      }
    })
    return () => { stop = true }
  }, [range])

  return (
    <div className="px-4 pt-3 pb-4">
      <h1 className="text-xl font-bold mb-3">深度分析</h1>

      {/* 范围切换 */}
      <div className="bg-bg-soft rounded-pill p-1 flex mb-4">
        {[{ id: 'weekly', label: '本周' }, { id: 'monthly', label: '本月' }].map(t => (
          <button key={t.id}
            onClick={() => setRange(t.id as Range)}
            className={`flex-1 py-2 text-xs font-medium rounded-pill transition ${
              range === t.id ? 'bg-white text-brand shadow' : 'text-ink-3'
            }`}
          >{t.label}</button>
        ))}
      </div>

      {/* AI 总结 */}
      <div className="card p-5 mb-4 border-l-4 border-l-brand">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-base"
            style={{ background: persona.color + '18' }}>{persona.emoji}</div>
          <h3 className="font-semibold">{persona.name}的分析</h3>
        </div>
        {loading ? (
          <p className="text-sm text-ink-3">正在分析数据...</p>
        ) : data?.summary ? (
          <p className="text-sm text-ink-2 leading-relaxed">{data.summary}</p>
        ) : (
          <p className="text-sm text-ink-3">分析暂不可用</p>
        )}
      </div>

      {/* AI 建议 */}
      {data && data.suggestions && data.suggestions.length > 0 && (
        <div className="card p-5 mb-4">
          <h3 className="font-semibold mb-3">建议这样做</h3>
          <div className="space-y-2">
            {data.suggestions.map((s, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-brand text-white text-xs flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                <p className="text-sm text-ink-2 leading-relaxed flex-1">{s}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 各科投入 */}
      <div className="card p-5 mb-4">
        <h3 className="font-semibold mb-3">各科投入时长</h3>
        <div className="space-y-3">
          {MOCK_SUBJECT_MONTHLY.map(s => {
            const max = Math.max(...s.weeks)
            return (
              <div key={s.subject}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm">{s.subject}</span>
                  <span className="text-xs text-ink-3">本月 {s.weeks.reduce((a, b) => a + b, 0)} h</span>
                </div>
                <div className="flex items-end gap-1 h-16">
                  {s.weeks.map((w, i) => (
                    <div key={i} className="flex-1 rounded-t"
                      style={{ height: `${(w / max) * 100}%`, background: s.color }} />
                  ))}
                </div>
                <div className="flex gap-1 mt-1 text-[10px] text-ink-3">
                  {['W1', 'W2', 'W3', 'W4'].map(l => (
                    <span key={l} className="flex-1 text-center">{l}</span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 效率最高时段 */}
      <div className="card p-5 mb-4">
        <h3 className="font-semibold mb-3">效率最高时段</h3>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: '上午', time: '09:00-11:00', focus: 88, color: '#16a34a' },
            { label: '下午', time: '15:00-16:00', focus: 90, color: '#2454FF' },
            { label: '晚上', time: '20:00-21:00', focus: 82, color: '#8b5cf6' }
          ].map(t => (
            <div key={t.label} className="bg-bg-soft rounded-xl p-3 text-center">
              <p className="text-xs text-ink-3">{t.label}</p>
              <p className="text-sm font-medium mt-1">{t.time}</p>
              <p className="text-2xl font-bold mt-1" style={{ color: t.color }}>{t.focus}</p>
              <p className="text-[10px] text-ink-3">专注度</p>
            </div>
          ))}
        </div>
      </div>

      {/* 娱乐黑洞 Top3 */}
      <div className="card p-5 mb-4">
        <h3 className="font-semibold mb-3">🕳️ 娱乐黑洞 Top3</h3>
        <div className="space-y-3">
          {stats.entertainmentTop3.map((e, i) => (
            <div key={e.label} className="flex items-start gap-3">
              <span className="text-2xl font-bold text-rose-500">{i + 1}</span>
              <div className="flex-1">
                <div className="flex justify-between items-baseline">
                  <span className="font-medium">{e.label}</span>
                  <span className="text-xs text-ink-3">{fmtMs(e.ms)}</span>
                </div>
                <p className="text-[11px] text-ink-3 mt-0.5 leading-relaxed">{e.reason}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 月度对比热力图 */}
      <div className="card p-5 mb-4">
        <h3 className="font-semibold mb-3">本月每日专注度热力图</h3>
        <Heatmap />
      </div>

      {/* 个性化提示 */}
      <div className="bg-bg-soft rounded-2xl p-4 mb-4">
        <p className="text-sm text-ink-2 leading-relaxed">
          <span className="font-medium">{persona.emoji} {persona.name}：</span>
          {persona.id === 'mentor' && '数据不会骗人，请按建议执行下一周计划。'}
          {persona.id === 'senior' && '别急别急，咱这样一周周来，会进步的。'}
          {persona.id === 'sassy' && '看了曲线，确定不是嘴上说要学？'}
          {persona.id === 'catgirl' && '喵看了下主人这周，还不错嘛，蹭蹭~'}
          {persona.id === 'parent' && '妈/爸看了你的进度，挺好，别熬坏了。'}
          {persona.id === 'bro' && '兄弟你稳的，咱俩拼这周。'}
        </p>
      </div>
    </div>
  )
}

function Heatmap() {
  // 30 天 mock 热力图
  const cells = Array.from({ length: 30 }, (_, i) => {
    const seed = (i * 7 + 13) % 100
    return seed < 50 ? 30 + seed : 50 + seed % 50
  })
  return (
    <div>
      <div className="grid grid-cols-6 gap-1.5">
        {cells.map((v, i) => {
          const color =
            v >= 85 ? '#16a34a' :
            v >= 70 ? '#86efac' :
            v >= 55 ? '#fde68a' :
            v >= 40 ? '#fdba74' : '#fca5a5'
          return (
            <div key={i} className="aspect-square rounded flex items-center justify-center text-[9px] text-white/90 font-medium"
              style={{ background: color }} title={`第 ${i + 1} 天 · ${v}`}>
              {v}
            </div>
          )
        })}
      </div>
      <div className="flex items-center justify-end gap-1 mt-2 text-[10px] text-ink-3">
        <span>低</span>
        <span className="w-3 h-3 rounded" style={{ background: '#fca5a5' }} />
        <span className="w-3 h-3 rounded" style={{ background: '#fde68a' }} />
        <span className="w-3 h-3 rounded" style={{ background: '#86efac' }} />
        <span className="w-3 h-3 rounded" style={{ background: '#16a34a' }} />
        <span>高</span>
      </div>
    </div>
  )
}
