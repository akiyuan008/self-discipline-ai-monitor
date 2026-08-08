import { useState } from 'react'
import { useStore } from '@/stores/useStore'
import { RARITY_ORDER, RARITY_META, CATEGORY_LABELS, type Rarity, type AchievementCategory } from '@/data/achievements'
import type { Achievement } from '@/data/achievements'
import Icon from '@/components/Icons'

interface Props {
  onBack: () => void
}

const CLIP = 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)'
const CLIP_SM = 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)'

export default function Achievements({ onBack }: Props) {
  const achievements = useStore(s => s.achievements)
  const [filter, setFilter] = useState<AchievementCategory | 'all'>('all')
  const [showNegative, setShowNegative] = useState(false)

  // 按稀有度分组
  const byRarity = (rarity: Rarity) => {
    let list = achievements.filter(a => a.rarity === rarity)
    if (filter !== 'all') list = list.filter(a => a.category === filter)
    return list
  }

  const unlockedCount = achievements.filter(a => a.unlocked).length
  const totalCount = achievements.length

  return (
    <div className="safe-top safe-bottom" style={{
      position: 'fixed', inset: 0, background: 'var(--bg)', zIndex: 500, overflow: 'auto'
    }}>
      <div style={{ padding: '16px 16px 32px' }}>
        {/* 头部 */}
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 16,
          paddingBottom: 10, borderBottom: '1px solid rgba(69,162,158,0.2)'
        }}>
          <button onClick={onBack} style={{
            width: 34, height: 34, background: 'var(--bg-alt)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--fg)',
            clipPath: CLIP_SM
          }}>
            <Icon.Back size={16} />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'Share Tech Mono, monospace', letterSpacing: 2 }}>
              ACHIEVEMENT WALL
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'Inter','PingFang SC','Microsoft YaHei',sans-serif" }}>
              成就勋章
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#f59e0b', fontFamily: 'Teko, sans-serif' }}>
              {unlockedCount}/{totalCount}
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'Share Tech Mono, monospace' }}>UNLOCKED</div>
          </div>
        </div>

        {/* 分类筛选 */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16, overflowX: 'auto' }} className="scrollbar-hide">
          {([
            { id: 'all' as const, label: '全部' },
            { id: 'abyss' as const, label: '深渊' },
            { id: 'study-time' as const, label: '学习时长' },
            { id: 'streak' as const, label: '打卡' },
            { id: 'special' as const, label: '彩蛋' },
          ] as const).map(cat => (
            <button key={cat.id} onClick={() => setFilter(cat.id)} style={{
              padding: '6px 12px', whiteSpace: 'nowrap',
              background: filter === cat.id ? 'rgba(69,162,158,0.15)' : 'var(--bg-alt)',
              border: `1px solid ${filter === cat.id ? '#45a29e' : 'var(--border)'}`,
              color: filter === cat.id ? '#45a29e' : 'var(--muted)',
              fontFamily: "'Inter','PingFang SC','Microsoft YaHei',sans-serif",
              fontSize: 12, cursor: 'pointer', clipPath: CLIP_SM
            }}>{cat.label}</button>
          ))}
        </div>

        {/* 成就勋章：按稀有度从上到下 */}
        {RARITY_ORDER.filter(r => r !== 'negative').map(rarity => {
          const list = byRarity(rarity)
          if (list.length === 0) return null
          const meta = RARITY_META[rarity]
          return (
            <div key={rarity} style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ width: 3, height: 16, background: meta.iconColor }} />
                <div style={{
                  fontSize: 13, fontWeight: 600, color: meta.color,
                  fontFamily: "'Inter','PingFang SC','Microsoft YaHei',sans-serif", letterSpacing: 1
                }}>
                  {meta.label}级
                </div>
                <div style={{ flex: 1, height: 1, background: `${meta.iconColor}30` }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {list.map(a => <AchievementCard key={a.id} achievement={a} />)}
              </div>
            </div>
          )
        })}

        {/* 负面成就区（默认折叠） */}
        {(() => {
          const negList = byRarity('negative')
          if (negList.length === 0) return null
          return (
            <div>
              <button onClick={() => setShowNegative(!showNegative)} style={{
                width: '100%', padding: '12px 14px', marginBottom: 10,
                background: 'rgba(97,97,97,0.08)', border: '1px solid rgba(97,97,97,0.3)',
                color: '#9e9e9e', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                cursor: 'pointer', clipPath: CLIP_SM,
                fontFamily: "'Inter','PingFang SC','Microsoft YaHei',sans-serif", fontSize: 13
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon.Warning size={14} color="#9e9e9e" />
                  航行事故记录 ({negList.filter(a => a.unlocked).length}/{negList.length})
                </span>
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>{showNegative ? '收起 ▲' : '展开 ▼'}</span>
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
    </div>
  )
}

function AchievementCard({ achievement: a }: { achievement: Achievement }) {
  const meta = RARITY_META[a.rarity]
  const isNegative = a.rarity === 'negative'
  const isLocked = !a.unlocked
  const isDiamond = a.rarity === 'diamond'
  const isRedeemed = !!(a as any).redeemed

  return (
    <div style={{
      background: a.unlocked ? meta.iconBg : 'var(--bg-alt)',
      border: `1px solid ${a.unlocked ? `${meta.iconColor}50` : 'var(--border)'}`,
      padding: '12px 10px', position: 'relative', clipPath: CLIP_SM,
      opacity: a.unlocked ? 1 : 0.78
    }}>
      {a.unlocked && a.rarity === 'diamond' && (
        <div style={{
          position: 'absolute', top: 4, right: 4, width: 6, height: 6, borderRadius: '50%',
          background: meta.iconColor, boxShadow: meta.glow, animation: 'breathe 3s infinite'
        }} />
      )}

      {/* 图标：未解锁压暗成剪影，但卡片整体可读 */}
      <div style={{
        width: 40, height: 40, margin: '0 auto 8px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: a.unlocked ? meta.iconBg : 'transparent',
        border: `1px solid ${a.unlocked ? `${meta.iconColor}50` : 'var(--border)'}`,
        clipPath: CLIP_SM, position: 'relative',
        opacity: a.unlocked ? 1 : 0.4
      }}>
        {isNegative && a.unlocked && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(0,0,0,0.1) 3px, rgba(0,0,0,0.1) 4px)',
            pointerEvents: 'none'
          }} />
        )}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
          stroke={a.unlocked ? (isRedeemed ? '#9e9e9e' : meta.iconColor) : 'var(--muted)'}
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d={a.iconPath} />
        </svg>
      </div>

      {/* 名称：始终可见 */}
      <div style={{
        fontSize: 13, fontWeight: 600, textAlign: 'center', marginBottom: 2,
        fontFamily: "'Inter','PingFang SC','Microsoft YaHei',sans-serif",
        color: a.unlocked ? (isRedeemed ? '#9e9e9e' : meta.color) : (isDiamond ? meta.color : 'var(--fg)')
      }}>
        {a.name}
      </div>

      {/* 描述/提示：始终可见 */}
      <div style={{
        fontSize: 10, textAlign: 'center', lineHeight: 1.4, marginBottom: 4,
        fontFamily: "'Inter','PingFang SC','Microsoft YaHei',sans-serif",
        color: 'var(--muted)', opacity: a.unlocked ? 1 : 0.85
      }}>
        {a.unlocked ? a.desc : (a.hint || a.desc)}
      </div>

      {isRedeemed && (
        <div style={{
          fontSize: 9, textAlign: 'center', padding: '1px 6px', marginTop: 4,
          background: 'rgba(34,197,94,0.12)', border: '1px solid #22c55e40',
          color: '#22c55e', borderRadius: 4,
          fontFamily: "'Inter','PingFang SC','Microsoft YaHei',sans-serif"
        }}>
          {(a as any).redeemed}
        </div>
      )}

      {isLocked && a.total > 1 && !isNegative && (
        <div style={{ marginTop: 4 }}>
          <div style={{ height: 3, background: 'var(--bg)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              width: `${Math.min(100, (a.progress / a.total) * 100)}%`,
              height: '100%', background: meta.iconColor, opacity: 0.6
            }} />
          </div>
          <div style={{ fontSize: 9, color: 'var(--muted)', textAlign: 'center', marginTop: 2, fontFamily: 'Share Tech Mono, monospace' }}>
            {a.progress}/{a.total}
          </div>
        </div>
      )}
    </div>
  )
}