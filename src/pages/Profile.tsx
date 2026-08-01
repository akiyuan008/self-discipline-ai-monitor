import { useStore } from '@/stores/useStore'

interface ProfileProps {
  onNavigate?: (page: 'achievements' | 'settings' | 'chat') => void
}

export default function Profile({ onNavigate }: ProfileProps) {
  const playerTag = useStore(s => s.playerTag)
  const streak = useStore(s => s.streak)
  const points = useStore(s => s.points)
  const hp = useStore(s => s.hp)
  const totalFocusMs = useStore(s => s.totalFocusMs)

  const focusHours = Math.floor(totalFocusMs / 3_600_000)
  const syncRate = Math.min(100, Math.round(hp * 0.8 + streak * 1.5))

  return (
    <div className="safe-top" style={{ padding: '24px 20px 140px' }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
        PROFILE
      </div>
      <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5, marginBottom: 16 }}>
        个人中心
      </h1>

      {/* ═══ 玩家档案卡 ═══ */}
      <div className="card" style={{
        padding: 20, borderRadius: 16, marginBottom: 12,
        position: 'relative', overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, rgba(59,130,246,0.06) 0%, transparent 60%)',
          pointerEvents: 'none'
        }} />
        <div style={{ position: 'relative' }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'flex-start', marginBottom: 12
          }}>
            <div>
              <div style={{
                fontSize: 11, color: 'var(--muted)',
                fontFamily: 'DM Mono, monospace', marginBottom: 4
              }}>
                CANDIDATE_FILE · {playerTag}
              </div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>
                {playerTag}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{
                fontSize: 28, fontWeight: 700, lineHeight: 1,
                color: hp < 30 ? 'var(--danger)' : 'var(--fg)'
              }}>
                {hp}
              </div>
              <div style={{ fontSize: 10, color: 'var(--muted)' }}>HP</div>
            </div>
          </div>

          {/* 快速统计 */}
          <div style={{
            display: 'flex', gap: 0,
            borderTop: '1px solid var(--border)',
            paddingTop: 8, marginTop: 4
          }}>
            <MiniStat label="连胜" value={`${streak}天`} />
            <Divider />
            <MiniStat label="积分" value={`${points}`} />
            <Divider />
            <MiniStat label="总专注" value={`${focusHours}h`} />
            <Divider />
            <MiniStat label="同步率" value={`${syncRate}%`} />
          </div>
        </div>
      </div>

      {/* 列表 */}
      <ListRow
        title="成就殿堂"
        desc="成就与里程碑"
        onClick={() => onNavigate?.('achievements')}
      />
      <ListRow
        title="系统设置"
        desc="深色模式、AI 配置、备份、关于"
        onClick={() => onNavigate?.('settings')}
      />
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ fontSize: 9, color: 'var(--muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 600 }}>{value}</div>
    </div>
  )
}

function Divider() {
  return <div style={{ width: 1, background: 'var(--border)' }} />
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
