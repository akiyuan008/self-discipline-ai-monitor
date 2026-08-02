import { useState, useMemo } from 'react'
import { useStore, type PointRecord } from '@/stores/useStore'

interface Props {
  onBack: () => void
}

function fmtTime(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  if (isToday) return `${hh}:${mm}`
  const mo = (d.getMonth() + 1).toString().padStart(2, '0')
  const dd = d.getDate().toString().padStart(2, '0')
  return `${mo}/${dd} ${hh}:${mm}`
}

export default function PointsDetail({ onBack }: Props) {
  const points = useStore(s => s.points)
  const history = useStore(s => s.pointHistory)
  const [filter, setFilter] = useState<'all' | 'earn' | 'spend'>('all')

  const totalEarned = useMemo(
    () => history.filter(r => r.type === 'earn').reduce((s, r) => s + r.amount, 0),
    [history]
  )
  const totalSpent = useMemo(
    () => history.filter(r => r.type === 'spend').reduce((s, r) => s + r.amount, 0),
    [history]
  )

  const filtered = filter === 'all' ? history : history.filter(r => r.type === filter)

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'var(--bg)',
        zIndex: 500,
        overflow: 'auto'
      }}
      className="safe-top safe-bottom animate-in"
    >
      <div style={{ padding: '16px 20px 32px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button
            onClick={onBack}
            style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'var(--card-bg)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--fg)'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
              POINTS_LOG
            </div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>积分明细</div>
          </div>
        </div>

        {/* 余额展示 */}
        <div className="card" style={{
          padding: 24, borderRadius: 16, marginBottom: 16,
          textAlign: 'center'
        }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace', marginBottom: 8 }}>
            CURRENT_BALANCE
          </div>
          <div style={{ fontSize: 48, fontWeight: 300, letterSpacing: -1, lineHeight: 1 }}>
            {points}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>PTS</div>
        </div>

        {/* 收支摘要 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <div className="card" style={{
            flex: 1, padding: 14, borderRadius: 12,
            display: 'flex', flexDirection: 'column', alignItems: 'center'
          }}>
            <div style={{ fontSize: 10, color: 'var(--success)', fontFamily: 'DM Mono, monospace', marginBottom: 4 }}>
              EARNED
            </div>
            <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--success)' }}>
              +{totalEarned}
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>累计获得</div>
          </div>
          <div className="card" style={{
            flex: 1, padding: 14, borderRadius: 12,
            display: 'flex', flexDirection: 'column', alignItems: 'center'
          }}>
            <div style={{ fontSize: 10, color: 'var(--danger)', fontFamily: 'DM Mono, monospace', marginBottom: 4 }}>
              SPENT
            </div>
            <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--danger)' }}>
              -{totalSpent}
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>累计消耗</div>
          </div>
        </div>

        {/* 筛选 */}
        <div style={{
          display: 'flex', gap: 6, padding: 4,
          background: 'var(--bg-alt)', borderRadius: 100,
          marginBottom: 16
        }}>
          {([
            { id: 'all', label: '全部' },
            { id: 'earn', label: '获得' },
            { id: 'spend', label: '消耗' }
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 100,
                background: filter === t.id ? 'var(--fg)' : 'transparent',
                color: filter === t.id ? 'var(--bg)' : 'var(--muted)',
                border: 'none', fontSize: 12, fontWeight: 500,
                cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 记录列表 */}
        {filtered.length === 0 ? (
          <div className="card" style={{
            padding: 40, borderRadius: 12, textAlign: 'center'
          }}>
            <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.3 }}>∅</div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>暂无积分记录</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filtered.map(r => (
              <RecordItem key={r.id} record={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function RecordItem({ record }: { record: PointRecord }) {
  const isEarn = record.type === 'earn'
  return (
    <div className="card" style={{
      padding: '12px 14px', borderRadius: 12,
      display: 'flex', alignItems: 'center', gap: 12
    }}>
      {/* 图标 */}
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: isEarn ? 'rgba(22, 163, 74, 0.1)' : 'rgba(229, 77, 46, 0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isEarn ? 'var(--success)' : 'var(--danger)'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          {isEarn ? (
            <path d="M12 5v14M5 12l7-7 7 7" />
          ) : (
            <path d="M12 19V5M5 12l7 7 7-7" />
          )}
        </svg>
      </div>

      {/* 信息 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 500,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
        }}>
          {record.reason}
        </div>
        <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'DM Mono, monospace', marginTop: 2 }}>
          {fmtTime(record.ts)}
        </div>
      </div>

      {/* 金额 */}
      <div style={{
        fontSize: 15, fontWeight: 700,
        fontFamily: 'DM Mono, monospace',
        color: isEarn ? 'var(--success)' : 'var(--danger)',
        flexShrink: 0
      }}>
        {isEarn ? '+' : '-'}{record.amount}
      </div>
    </div>
  )
}
