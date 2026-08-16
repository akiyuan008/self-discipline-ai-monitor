/**
 * src/components/growth/GrAchievements.tsx
 * Growth Mode Achievements — 成长勋章。温暖、中文为主的成就展示页。
 * 复用现有 achievements 数据和 RARITY_META。
 */
import { useState } from 'react'
import { useStore } from '@/stores/useStore'
import { RARITY_ORDER, RARITY_META, CATEGORY_LABELS, type Rarity, type AchievementCategory } from '@/data/achievements'
import type { Achievement } from '@/data/achievements'
import Icon from '@/components/Icons'

interface Props { onBack: () => void }

export default function GrAchievements({ onBack }: Props) {
  const achievements = useStore(s => s.achievements)
  const [filter, setFilter] = useState<AchievementCategory | 'all'>('all')
  const [showNegative, setShowNegative] = useState(false)

  const byRarity = (rarity: Rarity) => {
    let list = achievements.filter(a => a.rarity === rarity)
    if (filter !== 'all') list = list.filter(a => a.category === filter)
    return list
  }

  const unlockedCount = achievements.filter(a => a.unlocked).length
  const totalCount = achievements.length

  return (
    <div className="gr-page">
      {/* 标题 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <button onClick={onBack} style={{ width: 36, height: 36, background: 'var(--growth-surface)', border: '1px solid var(--growth-border)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--growth-text)' }}>
          <Icon.Back size={16} color="var(--growth-text)" />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, color: 'var(--growth-text-secondary)', marginBottom: 2 }}>成长勋章</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--growth-text)' }}>成就</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--growth-warm)' }}>{unlockedCount}/{totalCount}</div>
          <div style={{ fontSize: 11, color: 'var(--growth-text-secondary)' }}>已解锁</div>
        </div>
      </div>

      {/* 分类筛选 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto' }} className="scrollbar-hide">
        {([
          { id: 'all' as const, label: '全部' },
          { id: 'abyss' as const, label: '深渊' },
          { id: 'study-time' as const, label: '学习时长' },
          { id: 'streak' as const, label: '打卡' },
          { id: 'special' as const, label: '彩蛋' },
        ] as const).map(cat => (
          <button key={cat.id} onClick={() => setFilter(cat.id)} style={{
            padding: '6px 14px', whiteSpace: 'nowrap', borderRadius: 100, fontSize: 12, cursor: 'pointer',
            background: filter === cat.id ? 'var(--growth-primary)' : 'var(--growth-surface-alt)',
            color: filter === cat.id ? '#fff' : 'var(--growth-text-secondary)', border: 'none',
          }}>{cat.label}</button>
        ))}
      </div>

      {/* 成就勋章：按稀有度 */}
      {RARITY_ORDER.filter(r => r !== 'negative').map(rarity => {
        const list = byRarity(rarity)
        if (list.length === 0) return null
        const meta = RARITY_META[rarity]
        return (
          <div key={rarity} style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 3, height: 16, background: meta.iconColor, borderRadius: 2 }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: meta.color }}>{meta.label}级</div>
              <div style={{ flex: 1, height: 1, background: `${meta.iconColor}20` }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {list.map(a => <AchievementCard key={a.id} achievement={a} />)}
            </div>
          </div>
        )
      })}

      {/* 负面成就 */}
      {(() => {
        const negList = byRarity('negative')
        if (negList.length === 0) return null
        return (
          <div>
            <button onClick={() => setShowNegative(!showNegative)} className="gr-card-alt" style={{ width: '100%', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--growth-text-secondary)' }}>
                <Icon.Warning size={14} color="var(--growth-text-secondary)" />
                事故记录 ({negList.filter(a => a.unlocked).length}/{negList.length})
              </span>
              <span style={{ fontSize: 11, color: 'var(--growth-text-secondary)' }}>{showNegative ? '收起' : '展开'}</span>
            </button>
            {showNegative && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {negList.map(a => <AchievementCard key={a.id} achievement={a} />)}
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}

function AchievementCard({ achievement: a }: { achievement: Achievement }) {
  const meta = RARITY_META[a.rarity]
  const isNegative = a.rarity === 'negative'
  const isLocked = !a.unlocked
  const isRedeemed = !!(a as any).redeemed

  return (
    <div className="gr-card" style={{
      padding: '12px 10px', position: 'relative',
      background: a.unlocked ? meta.iconBg : 'var(--growth-surface-alt)',
      opacity: a.unlocked ? 1 : 0.7,
    }}>
      <div style={{
        width: 40, height: 40, margin: '0 auto 8px', borderRadius: 'var(--growth-radius-sm)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: a.unlocked ? meta.iconBg : 'transparent',
        border: `1px solid ${a.unlocked ? `${meta.iconColor}50` : 'var(--growth-border)'}`,
        opacity: a.unlocked ? 1 : 0.4,
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
          stroke={a.unlocked ? (isRedeemed ? 'var(--growth-text-secondary)' : meta.iconColor) : 'var(--growth-text-secondary)'}
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d={a.iconPath} />
        </svg>
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, textAlign: 'center', marginBottom: 2, color: a.unlocked ? (isRedeemed ? 'var(--growth-text-secondary)' : meta.color) : 'var(--growth-text)' }}>
        {a.name}
      </div>
      <div style={{ fontSize: 10, textAlign: 'center', lineHeight: 1.4, marginBottom: 4, color: 'var(--growth-text-secondary)' }}>
        {a.unlocked ? a.desc : (a.hint || a.desc)}
      </div>
      {isRedeemed && (
        <div style={{ fontSize: 9, textAlign: 'center', padding: '2px 8px', marginTop: 4, background: 'rgba(78,184,160,0.1)', borderRadius: 100, color: 'var(--success)' }}>
          {(a as any).redeemed}
        </div>
      )}
      {isLocked && a.total > 1 && !isNegative && (
        <div style={{ marginTop: 4 }}>
          <div className="gr-progress" style={{ height: 3 }}>
            <div className="gr-progress-fill" style={{ width: `${Math.min(100, (a.progress / a.total) * 100)}%`, background: meta.iconColor, opacity: 0.6 }} />
          </div>
          <div style={{ fontSize: 9, color: 'var(--growth-text-secondary)', textAlign: 'center', marginTop: 2 }}>{a.progress}/{a.total}</div>
        </div>
      )}
    </div>
  )
}
