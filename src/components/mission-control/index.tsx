/**
 * src/components/mission-control/index.tsx
 * Mission Control 基础组件库（Phase 1）。
 *
 * 设计原则：专业、沉稳、精密、克制。
 * 科技感来自布局、字体、状态、信息层级和细节。
 * 不依赖业务逻辑；只展示数据。
 */
import type { CSSProperties, ReactNode } from 'react'

// ═══ MC Card ═══
export function MCCard({ children, style, onClick }: { children: ReactNode; style?: CSSProperties; onClick?: () => void }) {
  return (
    <div className="mc-card" style={{ padding: 16, ...style }} onClick={onClick}>
      {children}
    </div>
  )
}

// ═══ MC Panel (内层) ═══
export function MCPanel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="mc-panel" style={{ padding: 12, ...style }}>
      {children}
    </div>
  )
}

// ═══ MC SectionHeader ═══
export function MCSectionHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <div style={{ width: 2, height: 12, background: 'var(--status-focus)' }} />
      <span className="mc-section-title" style={{ flex: 1 }}>{title}</span>
      {right}
    </div>
  )
}

// ═══ MC StatusBadge ═══
const STATUS_STYLES: Record<string, { color: string; bg: string }> = {
  READY: { color: 'var(--status-normal)', bg: 'rgba(91, 140, 184, 0.08)' },
  FOCUSING: { color: 'var(--status-focus)', bg: 'rgba(74, 158, 255, 0.08)' },
  DISTRACTED: { color: 'var(--status-deviation)', bg: 'rgba(199, 84, 80, 0.08)' },
  INTERVENTION: { color: 'var(--status-critical)', bg: 'rgba(204, 68, 68, 0.08)' },
  RECOVERING: { color: 'var(--status-warning)', bg: 'rgba(224, 165, 64, 0.08)' },
  COMPLETED: { color: 'var(--status-success)', bg: 'rgba(92, 184, 133, 0.08)' },
  MISSED: { color: 'var(--text-secondary)', bg: 'rgba(74, 85, 104, 0.08)' },
  IDLE: { color: 'var(--text-secondary)', bg: 'rgba(74, 85, 104, 0.08)' },
  PLANNED: { color: 'var(--text-secondary)', bg: 'rgba(74, 85, 104, 0.08)' },
  COMMITTED: { color: 'var(--status-normal)', bg: 'rgba(91, 140, 184, 0.08)' },
  EXECUTING: { color: 'var(--status-focus)', bg: 'rgba(74, 158, 255, 0.08)' },
  PARTIAL: { color: 'var(--status-warning)', bg: 'rgba(224, 165, 64, 0.08)' },
  ABANDONED: { color: 'var(--text-secondary)', bg: 'rgba(74, 85, 104, 0.08)' },
}

export function MCStatusBadge({ status, label }: { status: string; label?: string }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.IDLE
  return (
    <span className="mc-badge" style={{ color: s.color, background: s.bg, borderColor: s.color }}>
      <span className="mc-status-dot" style={{ background: s.color }} />
      {label || status}
    </span>
  )
}

// ═══ MC ProgressBar ═══
export function MCProgressBar({ pct, color = 'var(--status-focus)', style }: { pct: number; color?: string; style?: CSSProperties }) {
  return (
    <div className="mc-progress" style={style}>
      <div className="mc-progress-fill" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }} />
    </div>
  )
}

// ═══ MC DataBlock (数据展示) ═══
export function MCDataBlock({ label, value, unit, color }: { label: string; value: string | number; unit?: string; color?: string }) {
  return (
    <div className="mc-panel" style={{ padding: '12px 14px' }}>
      <div style={{ fontSize: 10, color: 'var(--text-secondary)', letterSpacing: 1, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-mc-mono)', color: color || 'var(--text-primary)', lineHeight: 1.1 }}>
        {value}{unit && <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 4 }}>{unit}</span>}
      </div>
    </div>
  )
}

// ═══ MC Button ═══
export function MCButton({ children, onClick, variant = 'default', style, disabled }: {
  children: ReactNode
  onClick?: () => void
  variant?: 'default' | 'primary'
  style?: CSSProperties
  disabled?: boolean
}) {
  const cls = variant === 'primary' ? 'mc-btn mc-btn-primary' : 'mc-btn'
  return (
    <button className={cls} onClick={onClick} disabled={disabled} style={{
      width: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      opacity: disabled ? 0.4 : 1,
      cursor: disabled ? 'not-allowed' : 'pointer',
      ...style
    }}>
      {children}
    </button>
  )
}

// ═══ MC MissionItem (通用任务条目) ═══
export function MCMissionItem({ title, subtitle, status, statusLabel, progress, onClick, right }: {
  title: string
  subtitle?: string
  status: string
  statusLabel?: string
  progress?: number
  onClick?: () => void
  right?: ReactNode
}) {
  return (
    <div className="mc-card" style={{
      padding: '12px 14px', marginBottom: 8,
      display: 'flex', alignItems: 'center', gap: 12,
      cursor: onClick ? 'pointer' : 'default',
      transition: 'border-color 0.15s'
    }} onClick={onClick}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mc-mono)' }}>
            {subtitle}
          </div>
        )}
        {progress !== undefined && progress > 0 && (
          <MCProgressBar pct={progress} style={{ marginTop: 6 }} />
        )}
      </div>
      <MCStatusBadge status={status} label={statusLabel} />
      {right}
    </div>
  )
}

// ═══ MC Ambient (环境纹理) ═══
export function MCAmbient() {
  return <div className="mc-ambient" />
}

// ═══ MC Page Wrapper ═══
export function MCPage({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <>
      <MCAmbient />
      <div className="mc-page" style={style}>
        {children}
      </div>
    </>
  )
}
