import { useState } from 'react'
import { useUserStore } from '@/stores/userStore'
import { REWARD_SHOP, type RewardItem } from '@/data/world'
import { getPosterText } from '@/lib/ai'
import { currentPersona } from '@/stores/userStore'

const TYPE_LABELS: Record<RewardItem['type'], { label: string; color: string }> = {
  voice: { label: '语音', color: '#D946EF' },
  skin: { label: '皮肤', color: '#2454FF' },
  pardon: { label: '免罚', color: '#16a34a' },
  share: { label: '战绩', color: '#f59e0b' },
  boost: { label: '增益', color: '#F43F5E' }
}

export default function Reward() {
  const points = useUserStore(s => s.points)
  const spendPoints = useUserStore(s => s.spendPoints)
  const unlockVoice = useUserStore(s => s.unlockVoice)
  const unlockSkin = useUserStore(s => s.unlockSkin)
  const addPardonCard = useUserStore(s => s.addPardonCard)
  const unlockedVoices = useUserStore(s => s.unlockedVoices)
  const unlockedSkins = useUserStore(s => s.unlockedSkins)
  const [filter, setFilter] = useState<'all' | RewardItem['type']>('all')
  const [toast, setToast] = useState<string | null>(null)
  const [poster, setPoster] = useState<string[] | null>(null)

  const items = filter === 'all' ? REWARD_SHOP : REWARD_SHOP.filter(i => i.type === filter)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2200)
  }

  function buy(item: RewardItem) {
    if (points < item.cost) {
      showToast('积分不足')
      return
    }
    const ok = spendPoints(item.cost)
    if (!ok) {
      showToast('积分扣分失败')
      return
    }
    if (item.type === 'voice') unlockVoice(item.id)
    if (item.type === 'skin') unlockSkin(item.id)
    if (item.type === 'pardon' && item.id === 'p1') addPardonCard(1)
    if (item.type === 'pardon' && item.id === 'p2') addPardonCard(5)
    if (item.type === 'share' && item.id === 'g1') {
      getPosterText().then(r => setPoster(r.lines))
    }
    showToast(`✓ ${item.name} 已兑换`)
  }

  function owned(item: RewardItem): boolean {
    if (item.type === 'voice') return unlockedVoices.includes(item.id)
    if (item.type === 'skin') return unlockedSkins.includes(item.id)
    return false
  }

  return (
    <div className="px-4 pt-3 pb-4">
      <h1 className="text-xl font-bold mb-2">奖励商店</h1>
      <p className="text-xs text-ink-3 mb-3">学习积分（💎）可在此兑换</p>

      {/* 余额 */}
      <div className="card p-4 mb-4 bg-gradient-to-r from-brand to-brand-700 text-white">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-xs opacity-80">当前积分</p>
            <p className="text-3xl font-bold">💎 {points}</p>
          </div>
          <div className="text-right">
            <p className="text-xs opacity-80">免罚卡</p>
            <p className="text-xl font-semibold">🛡 {useUserStore.getState().pardonCards}</p>
          </div>
        </div>
      </div>

      {/* 类别筛选 */}
      <div className="overflow-x-auto flex gap-2 mb-4 scrollbar-hide">
        {(['all', 'voice', 'skin', 'pardon', 'share', 'boost'] as const).map(t => (
          <button key={t}
            onClick={() => setFilter(t)}
            className={`chip whitespace-nowrap ${filter === t ? 'bg-brand text-white' : 'bg-bg-soft text-ink-2'}`}
          >{t === 'all' ? '全部' : TYPE_LABELS[t].label}</button>
        ))}
      </div>

      {/* 商品列表 */}
      <div className="grid grid-cols-2 gap-3">
        {items.map(item => {
          const type = TYPE_LABELS[item.type]
          const isOwned = owned(item)
          const affordable = points >= item.cost
          return (
            <div key={item.id} className="card p-3 flex flex-col">
              <div className="flex items-start justify-between mb-2">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl"
                  style={{ background: type.color + '14' }}>{item.emoji}</div>
                <span className="chip" style={{ color: type.color, background: type.color + '14' }}>{type.label}</span>
              </div>
              <h3 className="font-semibold text-sm">{item.name}</h3>
              <p className="text-[11px] text-ink-3 mt-0.5 leading-relaxed flex-1">{item.desc}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm font-bold text-brand">💎 {item.cost}</span>
                {isOwned ? (
                  <button className="chip bg-green-50 text-green-700" disabled>已拥有</button>
                ) : (
                  <button
                    className={`px-3 py-1.5 rounded-pill text-xs font-medium ${
                      affordable ? 'bg-brand text-white active:opacity-80' : 'bg-bg-soft text-ink-3'
                    }`}
                    onClick={() => buy(item)}
                    disabled={!affordable}
                  >{affordable ? '兑换' : '积分不足'}</button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* 战绩图弹层 */}
      {poster && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end" onClick={() => setPoster(null)}>
          <div className="bg-white w-full rounded-t-3xl p-5 max-w-[480px] mx-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-3 text-center">学霸战绩图</h2>
            <div className="bg-gradient-to-br from-brand-50 to-purple-50 rounded-2xl p-5 text-center border-2 border-dashed border-brand-300">
              {poster.map((l, i) => (
                <p key={i} className={`mb-1 ${i === 0 ? 'text-base font-bold text-brand' : 'text-sm text-ink-2'}`}>{l}</p>
              ))}
              <div className="mt-3 text-3xl">{currentPersona().emoji}</div>
              <p className="text-[10px] text-ink-3 mt-1">自律养成 · AI监工</p>
            </div>
            <button className="btn-primary w-full mt-4 py-2.5" onClick={() => {
              const text = poster.join('\n')
              if (navigator.share) {
                navigator.share({ title: '我的学霸战绩', text })
              } else {
                navigator.clipboard?.writeText(text)
                setToast('已复制到剪贴板')
                setTimeout(() => setToast(null), 2000)
              }
            }}>分享出去</button>
            <button className="text-xs text-ink-3 mt-2 w-full" onClick={() => setPoster(null)}>关闭</button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 bg-black/80 text-white text-sm px-4 py-2 rounded-pill z-50">
          {toast}
        </div>
      )}
    </div>
  )
}
