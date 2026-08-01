import { useStore } from '@/stores/useStore'

interface ProfileProps {
  onNavigate?: (page: 'achievements' | 'settings' | 'chat') => void
}

export default function Profile({ onNavigate }: ProfileProps) {
  const playerTag = useStore(s => s.playerTag)
  const streak = useStore(s => s.streak)
  const totalFocusMs = useStore(s => s.totalFocusMs)
  const points = useStore(s => s.points)
  const hp = useStore(s => s.hp)

  const focusHours = Math.floor(totalFocusMs / 3600_000)
  // 同步率 = HP * 0.8 + 连胜 * 1（mock 算法）
  const syncRate = Math.min(100, Math.round(hp * 0.8 + streak * 1.5))

  return (
    <div className="safe-top" style={{ padding: '24px 20px 140px' }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
        PROFILE
      </div>
      <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5, marginBottom: 16 }}>
        个人中心
      </h1>

      {/* 玩家卡 */}
      <div className="card" style={{
        padding: 20, borderRadius: 16, marginBottom: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div style={{
            width: 56, height: 56,
            borderRadius: 16,
            background: 'var(--bg-alt)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24
          }}>
            🎮
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{playerTag}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
              LV.{Math.floor(streak / 7) + 1} · {syncRate}% SYNC
            </div>
          </div>
        </div>
        <div style={{ height: 6, background: 'var(--bg-alt)', borderRadius: 100, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${syncRate}%`,
            background: 'var(--success)',
            borderRadius: 100
          }} />
        </div>
      </div>

      {/* 数据网格 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8, marginBottom: 12
      }}>
        <Stat label="总专注" value={`${focusHours}`} suffix="HOURS" />
        <Stat label="连胜" value={`${streak}`} suffix="DAYS" />
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8, marginBottom: 12
      }}>
        <Stat label="积分" value={points.toString()} />
        <Stat label="精神力" value={`${hp}`} suffix="/100" />
      </div>

      {/* 列表 */}
      <ListRow
        title="监管者"
        desc="对话式督促"
        onClick={() => onNavigate?.('chat')}
      />
      <ListRow
        title="成就殿堂"
        desc="查看成就进度"
        onClick={() => onNavigate?.('achievements')}
      />
      <ListRow
        title="系统设置"
        desc="深色模式、AI 配置"
        onClick={() => onNavigate?.('settings')}
      />
      <ListRow
        title="关于 Cyber Survival"
        desc="v2.0.0 · React + Capacitor"
        onClick={() => {}}
      />
    </div>
  )
}

function Stat({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="card" style={{
      padding: 14, borderRadius: 12, textAlign: 'center'
    }}>
      <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
        {label.toUpperCase()}
      </div>
      <div style={{ fontSize: 22, fontWeight: 500, marginTop: 4 }}>
        {value}
        {suffix && (
          <span style={{ fontSize: 9, color: 'var(--muted)', marginLeft: 3, fontFamily: 'DM Mono, monospace' }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  )
}

function ListRow({ title, desc, onClick }: { title: string; desc: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        padding: '14px 16px',
        background: 'var(--card-bg)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        marginBottom: 8,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        cursor: 'pointer',
        textAlign: 'left'
      }}
    >
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--fg)' }}>{title}</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{desc}</div>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  )
}
