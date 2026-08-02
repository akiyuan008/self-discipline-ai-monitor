import { useState } from 'react'
import { useStore } from '@/stores/useStore'
import type { PageId } from '@/stores/useStore'

interface PointsDetailProps {
  onNavigate?: (page: PageId) => void
}

export default function PointsDetail({ onNavigate }: PointsDetailProps) {
  const points = useStore(s => s.points)
  const pointHistory = useStore(s => s.pointHistory)
  const [filter, setFilter] = useState<'all' | 'earn' | 'spend'>('all')

  const filtered = pointHistory.filter(r => filter === 'all' || r.type === filter)
  const totalEarned = pointHistory.filter(r => r.type === 'earn').reduce((s, r) => s + r.amount, 0)
  const totalSpent = pointHistory.filter(r => r.type === 'spend').reduce((s, r) => s + r.amount, 0)

  const formatDate = (ts: number) => {
    const d = new Date(ts)
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  }

  return (
    <div className="view active safe-top safe-bottom" style={{ padding: '0 16px 100px', overflowY: 'auto' }}>
      {/* Header */}
      <header style={{ padding: '24px 0 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => onNavigate?.('home')}
          style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--fg)' }}
        >
          ←
        </button>
        <div>
          <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 1, fontWeight: 600 }}>
            POINTS_LOG
          </div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>积分明细</div>
        </div>
      </header>

      {/* 余额展示 */}
      <div className="card" style={{ padding: 24, marginBottom: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 1, fontWeight: 600, marginBottom: 8 }}>
          CURRENT_BALANCE
        </div>
        <div style={{ fontSize: 40, fontWeight: 700 }}>
          {points}
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>PTS</div>
      </div>

      {/* 收支摘要 */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <div className="card" style={{ flex: 1, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>EARNED</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--success)' }}>+{totalEarned}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>累计获得</div>
        </div>
        <div className="card" style={{ flex: 1, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>SPENT</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--danger)' }}>-{totalSpent}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>累计消耗</div>
        </div>
      </div>

      {/* 筛选 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {([
          { id: 'all' as const, label: '全部' },
          { id: 'earn' as const, label: '获得' },
          { id: 'spend' as const, label: '消耗' }
        ]).map(t => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id)}
            style={{
              padding: '8px 16px',
              borderRadius: 100,
              border: '1px solid var(--border)',
              background: filter === t.id ? 'var(--fg)' : 'var(--card-bg)',
              color: filter === t.id ? 'var(--bg)' : 'var(--fg)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 记录列表 */}
      {filtered.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>∅</div>
          <div style={{ fontSize: 14 }}>暂无积分记录</div>
        </div>
      ) : (
        <div className="card" style={{ padding: '8px 16px' }}>
          {filtered.map(r => (
            <div
              key={r.id}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 0',
                borderBottom: '1px solid var(--border)'
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{r.reason}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{formatDate(r.ts)}</div>
              </div>
              <div style={{
                fontSize: 15, fontWeight: 700,
                color: r.type === 'earn' ? 'var(--success)' : 'var(--danger)'
              }}>
                {r.type === 'earn' ? '+' : '-'}{r.amount}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ height: 24 }} />
    </div>
  )
}
