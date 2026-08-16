/**
 * src/components/growth/GrPointsDetail.tsx
 * Growth Mode PointsDetail — 积分明细。温暖、中文为主。
 */
import { useState, useMemo } from 'react'
import { useStore, type PointRecord } from '@/stores/useStore'
import Icon from '@/components/Icons'

interface Props { onBack: () => void }

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

export default function GrPointsDetail({ onBack }: Props) {
  const points = useStore(s => s.points)
  const history = useStore(s => s.pointHistory)
  const [filter, setFilter] = useState<'all' | 'earn' | 'spend'>('all')

  const totalEarned = useMemo(
    () => history.filter(r => r.type === 'earn').reduce((s, r) => s + r.amount, 0), [history]
  )
  const totalSpent = useMemo(
    () => history.filter(r => r.type === 'spend').reduce((s, r) => s + r.amount, 0), [history]
  )
  const filtered = filter === 'all' ? history : history.filter(r => r.type === filter)

  return (
    <div className="gr-page">
      {/* 标题 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={onBack} style={{ width: 36, height: 36, background: 'var(--growth-surface)', border: '1px solid var(--growth-border)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <Icon.Back size={16} color="var(--growth-text)" />
        </button>
        <div>
          <div style={{ fontSize: 14, color: 'var(--growth-text-secondary)', marginBottom: 2 }}>积分明细</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--growth-text)' }}>成长值记录</div>
        </div>
      </div>

      {/* 余额 */}
      <div className="gr-card" style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: 'var(--growth-text-secondary)', marginBottom: 8 }}>当前余额</div>
        <div style={{ fontSize: 48, fontWeight: 300, letterSpacing: -1, lineHeight: 1, color: 'var(--growth-text)' }}>{points}</div>
        <div style={{ fontSize: 11, color: 'var(--growth-text-secondary)', marginTop: 4 }}>积分</div>
      </div>

      {/* 收支摘要 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <div className="gr-card-alt" style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--success)', marginBottom: 4 }}>累计获得</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--success)' }}>+{totalEarned}</div>
        </div>
        <div className="gr-card-alt" style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--danger)', marginBottom: 4 }}>累计消耗</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--danger)' }}>-{totalSpent}</div>
        </div>
      </div>

      {/* 筛选 */}
      <div style={{ display: 'flex', gap: 6, padding: 4, background: 'var(--growth-surface-alt)', borderRadius: 100, marginBottom: 16 }}>
        {([
          { id: 'all', label: '全部' },
          { id: 'earn', label: '获得' },
          { id: 'spend', label: '消耗' }
        ] as const).map(t => (
          <button key={t.id} onClick={() => setFilter(t.id)} style={{
            flex: 1, padding: '8px 12px', borderRadius: 100,
            background: filter === t.id ? 'var(--growth-primary)' : 'transparent',
            color: filter === t.id ? '#fff' : 'var(--growth-text-secondary)',
            border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer',
          }}>{t.label}</button>
        ))}
      </div>

      {/* 记录列表 */}
      {filtered.length === 0 ? (
        <div className="gr-card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.3 }}>∅</div>
          <div style={{ fontSize: 13, color: 'var(--growth-text-secondary)' }}>暂无积分记录</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map(r => <RecordItem key={r.id} record={r} />)}
        </div>
      )}
    </div>
  )
}

function RecordItem({ record }: { record: PointRecord }) {
  const isEarn = record.type === 'earn'
  return (
    <div className="gr-card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{
        width: 36, height: 36, borderRadius: 'var(--growth-radius-sm)',
        background: isEarn ? 'rgba(91,160,112,0.1)' : 'rgba(214,90,74,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isEarn ? 'var(--success)' : 'var(--danger)'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          {isEarn ? <path d="M12 5v14M5 12l7-7 7 7" /> : <path d="M12 19V5M5 12l7 7 7-7" />}
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--growth-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{record.reason}</div>
        <div style={{ fontSize: 10, color: 'var(--growth-text-secondary)', marginTop: 2 }}>{fmtTime(record.ts)}</div>
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: isEarn ? 'var(--success)' : 'var(--danger)', flexShrink: 0 }}>
        {isEarn ? '+' : '-'}{record.amount}
      </div>
    </div>
  )
}
