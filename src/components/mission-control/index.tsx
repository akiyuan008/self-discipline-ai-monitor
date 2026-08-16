/**
 * src/components/mission-control/index.tsx
 * Future Industrial Mission Control System 基础组件库。
 * 不是矩形卡片堆叠，而是工业分层面板 + 状态线 + 数据行。
 */
import type { CSSProperties, ReactNode } from 'react'

// ═══ 环境层 ═══
export function MCAmbient() { return <div className="mc-ambient" /> }

export function MCPage({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <>
      <MCAmbient />
      <div className="mc-page" style={style}>{children}</div>
    </>
  )
}

// ═══ 工业模块面板 ═══
export function MCModule({ children, style, onClick }: { children: ReactNode; style?: CSSProperties; onClick?: () => void }) {
  return (
    <div className="mc-module" style={style} onClick={onClick}>{children}</div>
  )
}

// ═══ 工业内嵌区域 ═══
export function MCInner({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div className="mc-inner" style={style}>{children}</div>
}

// ═══ 工业区域标题 ═══
export function MCSection({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div className="mc-section">
      <span className="mc-section-title">{title}</span>
      {right && <span className="mc-section-right">{right}</span>}
    </div>
  )
}

// ═══ 工业状态指示 ═══
const STATUS_COLORS: Record<string, string> = {
  READY: 'var(--status-normal)', FOCUSING: 'var(--status-focus)', DISTRACTED: 'var(--status-deviation)',
  INTERVENTION: 'var(--status-critical)', RECOVERING: 'var(--status-warning)', COMPLETED: 'var(--status-success)',
  MISSED: 'var(--status-idle)', IDLE: 'var(--status-idle)', PLANNED: 'var(--status-idle)',
  COMMITTED: 'var(--status-normal)', EXECUTING: 'var(--status-focus)', PARTIAL: 'var(--status-warning)',
  ABANDONED: 'var(--status-idle)',
}
const STATUS_LABELS: Record<string, string> = {
  READY: 'READY', FOCUSING: 'ACTIVE', DISTRACTED: 'INTERRUPTED',
  INTERVENTION: 'CRITICAL', RECOVERING: 'RECOVERING', COMPLETED: 'COMPLETED',
  MISSED: 'MISSED', IDLE: 'IDLE', PLANNED: 'STANDBY',
  COMMITTED: 'COMMITTED', EXECUTING: 'ACTIVE', PARTIAL: 'PARTIAL',
  ABANDONED: 'ABANDONED',
}
export function MCStatus({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || 'var(--status-idle)'
  const label = STATUS_LABELS[status] || status
  return (
    <span className="mc-status" style={{ color }}>
      <span className="mc-status-dot" style={{ background: color }} />
      {label}
    </span>
  )
}

// ═══ 工业进度条 ═══
export function MCProgress({ pct, color = 'var(--status-normal)', style }: { pct: number; color?: string; style?: CSSProperties }) {
  return (
    <div className="mc-progress" style={style}>
      <div className="mc-progress-fill" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }} />
    </div>
  )
}

// ═══ 工业数据行 ═══
export function MCDataRow({ label, value, unit, color }: { label: string; value: string | number; unit?: string; color?: string }) {
  return (
    <div className="mc-data-row">
      <span className="mc-data-label">{label}</span>
      <span className="mc-data-value" style={color ? { color } : undefined}>{value}</span>
      {unit && <span className="mc-data-unit">{unit}</span>}
    </div>
  )
}

// ═══ 工业操作终端 ═══
export function MCButton({ children, onClick, variant = 'default', style, disabled }: {
  children: ReactNode; onClick?: () => void; variant?: 'default' | 'primary'; style?: CSSProperties; disabled?: boolean
}) {
  const cls = variant === 'primary' ? 'mc-btn mc-btn-primary' : 'mc-btn'
  return (
    <button className={cls} onClick={onClick} disabled={disabled} style={{
      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      opacity: disabled ? 0.3 : 1, cursor: disabled ? 'not-allowed' : 'pointer', ...style
    }}>{children}</button>
  )
}

// ═══ 工业任务模块行 ═══
const ROW_STATUS_MAP: Record<string, string> = {
  READY: 'standby', FOCUSING: 'active', DISTRACTED: 'error', INTERVENTION: 'error',
  RECOVERING: 'warning', COMPLETED: 'done', MISSED: 'done', IDLE: 'standby',
  PLANNED: 'standby', COMMITTED: 'standby', EXECUTING: 'active', PARTIAL: 'warning', ABANDONED: 'done',
}
export function MCMissionRow({ title, subtitle, status, progress, onClick, right }: {
  title: string; subtitle?: string; status: string; progress?: number; onClick?: () => void; right?: ReactNode
}) {
  const rowStatus = ROW_STATUS_MAP[status] || 'standby'
  return (
    <div className="mc-mission-row" data-status={rowStatus} onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 1 }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'var(--font-mc-mono)' }}>
            {subtitle}
          </div>
        )}
        {progress !== undefined && progress > 0 && (
          <MCProgress pct={progress} style={{ marginTop: 6 }} />
        )}
      </div>
      <MCStatus status={status} />
      {right}
    </div>
  )
}
