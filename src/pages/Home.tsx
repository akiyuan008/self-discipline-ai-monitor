import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUserStore, currentPersona } from '@/stores/userStore'
import { useStatsStore, studyMinutesToday, entertainmentMinutesToday, focusScoreToday } from '@/stores/statsStore'
import { fmtMs, fmtHM, todayDateLabel } from '@/lib/format'
import { isLateNight } from '@/lib/usageStats'
import { careCheck } from '@/lib/ai'
import { useChatStore } from '@/stores/chatStore'
import { ACHIEVEMENTS, WORLD_MAPS, PETS } from '@/data/world'

export default function Home() {
  const nav = useNavigate()
  const u = useUserStore()
  const persona = currentPersona()
  const stats = useStatsStore()
  const push = useChatStore(s => s.push)

  const studyMin = studyMinutesToday()
  const entMin = entertainmentMinutesToday()
  const focus = focusScoreToday()
  const goalMin = u.dailyGoalMin
  const progress = Math.min(100, Math.round((studyMin / goalMin) * 100))
  const today = todayDateLabel()

  const [careMsg, setCareMsg] = useState<string | null>(null)
  const [careMood, setCareMood] = useState<string>('care')

  useEffect(() => {
    let stop = false
    async function poll() {
      while (!stop) {
        const r = await careCheck()
        if (r.trigger && !stop) {
          setCareMsg(r.reply)
          setCareMood(r.mood)
          push({ sender: 'ai', text: r.reply, mood: r.mood as any })
        }
        await new Promise(r => setTimeout(r, 15 * 60 * 1000)) // 15 分钟一次
      }
    }
    poll()
    return () => { stop = true }
  }, [push])

  const ringCirc = 2 * Math.PI * 60
  const ringOffset = ringCirc * (1 - progress / 100)

  const unlockedMapsCount = u.unlockedMaps.length
  const unlockedPetsCount = u.unlockedPets.length
  const achievementsCount = ACHIEVEMENTS.filter(a => a.unlocked).length

  return (
    <div className="px-4 pb-4 pt-3">
      {/* 问候 */}
      <div className="animate-in mb-4">
        <p className="text-xs text-ink-3">{today}</p>
        <h1 className="text-xl font-bold mt-0.5">{persona.greeting}</h1>
      </div>

      {/* 关怀提示 */}
      {careMsg && (
        <div className={`card p-4 mb-4 animate-in border-l-4 ${
          careMood === 'punish' ? 'border-l-rose-500 bg-rose-50' :
          careMood === 'warn' ? 'border-l-amber-500 bg-amber-50' :
          'border-l-brand bg-bg-soft'
        }`}>
          <div className="flex items-start gap-2">
            <span className="text-xl">{persona.emoji}</span>
            <div className="flex-1">
              <p className="text-sm text-ink-1 leading-relaxed">{careMsg}</p>
            </div>
            <button className="text-xs text-brand font-medium" onClick={() => nav('/chat')}>回复</button>
          </div>
        </div>
      )}

      {/* 焦点：今日学习进度环 */}
      <div className="card p-5 mb-4 animate-in relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-32 h-32 rounded-full bg-brand-50 opacity-60" />
        <div className="relative flex items-center gap-5">
          <svg width="140" height="140" viewBox="0 0 140 140" className="shrink-0">
            <circle cx="70" cy="70" r="60" fill="none" stroke="#EEEEEE" strokeWidth="10" />
            <circle
              cx="70" cy="70" r="60" fill="none" stroke={persona.color} strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={ringCirc}
              strokeDashoffset={ringOffset}
              transform="rotate(-90 70 70)"
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
            <text x="70" y="68" textAnchor="middle" fontSize="24" fontWeight="700" fill="#1A2029">{progress}%</text>
            <text x="70" y="86" textAnchor="middle" fontSize="10" fill="#838A95">目标 {goalMin}min</text>
          </svg>
          <div className="flex-1 space-y-2">
            <Metric label="学习" value={fmtMs(studyMin * 60_000)} color="#16a34a" />
            <Metric label="娱乐" value={fmtMs(entMin * 60_000)} color="#F43F5E" />
            <Metric label="专注度" value={`${focus}`} color={persona.color} suffix="/100" />
          </div>
        </div>
      </div>

      {/* 今日人格亮点 */}
      <div className="card p-4 mb-4 animate-in">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">今日人格反馈</h3>
          <button className="text-xs text-brand" onClick={() => nav('/chat')}>聊聊 ›</button>
        </div>
        <p className="text-sm text-ink-2 leading-relaxed">
          {focus >= 80
            ? `${persona.catchphrases[3]} 学习时长 ${(studyMin / 60).toFixed(1)}h，专注度 ${focus}，状态在线。${persona.name}对你的评价：稳。`
            : focus >= 60
              ? `学了 ${fmtMs(studyMin * 60_000)}，但娱乐时长有点高。${persona.catchphrases[1] || persona.catchphrases[0]}`
              : `今天专注度只有 ${focus}，${persona.catchphrases[1] || '别拖了'} 下个番茄钟走起。`}
        </p>
      </div>

      {/* 快速入口 */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { icon: '📊', label: '深度分析', to: '/analysis', color: '#2454FF' },
          { icon: '🛍️', label: '奖励商店', to: '/reward', color: '#D946EF' },
          { icon: '🐾', label: '虚拟宠物', to: '/pet', color: '#8b5cf6' },
          { icon: '🗺️', label: '自律地图', to: '/pet', color: '#16a34a' }
        ].map(item => (
          <button key={item.label} onClick={() => nav(item.to)}
            className="card p-3 flex flex-col items-center gap-1 active:scale-95 transition"
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg" style={{ background: item.color + '14' }}>{item.icon}</div>
            <span className="text-[11px] text-ink-2">{item.label}</span>
          </button>
        ))}
      </div>

      {/* 自律世界概览 */}
      <div className="card p-4 mb-4 animate-in">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">自律世界</h3>
          <button className="text-xs text-brand" onClick={() => nav('/pet')}>查看全部 ›</button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-bg-soft rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-brand">{unlockedMapsCount}<span className="text-xs text-ink-3 font-normal">/{WORLD_MAPS.length}</span></p>
            <p className="text-[11px] text-ink-3 mt-0.5">地图</p>
          </div>
          <div className="bg-bg-soft rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-brand">{unlockedPetsCount}<span className="text-xs text-ink-3 font-normal">/{PETS.length}</span></p>
            <p className="text-[11px] text-ink-3 mt-0.5">宠物</p>
          </div>
          <div className="bg-bg-soft rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-brand">{achievementsCount}<span className="text-xs text-ink-3 font-normal">/{ACHIEVEMENTS.length}</span></p>
            <p className="text-[11px] text-ink-3 mt-0.5">成就</p>
          </div>
        </div>
      </div>

      {/* 用时分布 mini */}
      <div className="card p-4 mb-4 animate-in">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">今日时长 Top5</h3>
          <button className="text-xs text-brand" onClick={() => nav('/stats')}>详细 ›</button>
        </div>
        <TopBars />
      </div>

      {/* 深夜提醒 */}
      {isLateNight() && (
        <div className="card p-4 mb-4 animate-in bg-amber-50 border border-amber-200">
          <div className="flex items-start gap-2">
            <span className="text-xl">🌙</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800">深夜了，{u.nickname}</p>
              <p className="text-xs text-amber-700 mt-1">{persona.catchphrases[3] || '别硬撑'} 明天的脑子会感谢你今晚的睡眠。</p>
            </div>
            <button className="text-xs text-amber-700 font-medium" onClick={() => nav('/chat')}>说说</button>
          </div>
        </div>
      )}
    </div>
  )
}

function Metric({ label, value, color, suffix }: { label: string; value: string; color: string; suffix?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-ink-3">{label}</span>
      <span className="font-semibold" style={{ color }}>{value}{suffix}</span>
    </div>
  )
}

function TopBars() {
  const stats = useStatsStore(s => s.todayStats)
  const sorted = [...stats].sort((a, b) => b.totalMs - a.totalMs).slice(0, 5)
  const max = sorted[0]?.totalMs || 1
  return (
    <div className="space-y-2">
      {sorted.map(s => (
        <div key={s.packageName} className="flex items-center gap-2">
          <div className="w-20 text-xs text-ink-2 truncate">{s.label}</div>
          <div className="flex-1 h-5 bg-bg-soft rounded overflow-hidden">
            <div
              className="h-full rounded flex items-center justify-end px-1.5"
              style={{ width: `${Math.max(8, (s.totalMs / max) * 100)}%`, background: s.isStudy ? '#16a34a' : '#F43F5E' }}
            >
              <span className="text-[9px] text-white font-medium">{fmtHM(s.totalMs).h}h{fmtHM(s.totalMs).m}m</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
