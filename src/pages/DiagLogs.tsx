import { useState } from 'react'
import { logger, type LogLevel } from '@/lib/logger'
import { showToast } from '@/components/Toast'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Capacitor } from '@capacitor/core'

interface Props {
  onBack: () => void
}

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: 'var(--muted)',
  info: 'var(--info)',
  warn: 'var(--warning)',
  error: 'var(--danger)'
}

const LEVEL_LABELS: Record<LogLevel, string> = {
  debug: 'DEBUG',
  info: 'INFO',
  warn: 'WARN',
  error: 'ERROR'
}

function fmtTime(ts: number): string {
  const d = new Date(ts)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

export default function DiagLogs({ onBack }: Props) {
  const [filterLevel, setFilterLevel] = useState<LogLevel | 'all'>('all')
  const [entries, setEntries] = useState(logger.getAll())

  const filtered = filterLevel === 'all' ? entries : entries.filter(e => e.level === filterLevel)

  const handleExport = async () => {
    const text = logger.exportText()
    try {
      if (Capacitor.getPlatform() === 'android') {
        const filename = `diag-logs-${new Date().toISOString().slice(0, 10)}.txt`
        await Filesystem.writeFile({
          path: filename,
          data: text,
          directory: Directory.Documents,
          encoding: Encoding.UTF8
        })
        showToast(`日志已导出到文档目录：${filename}`)
      } else {
        // Web 环境：复制到剪贴板
        await navigator.clipboard.writeText(text)
        showToast('日志已复制到剪贴板')
      }
    } catch (e: any) {
      showToast('导出失败：' + (e?.message || '未知错误'))
    }
  }

  const handleClear = () => {
    logger.clear()
    setEntries([])
    showToast('日志已清空')
  }

  const counts = {
    error: entries.filter(e => e.level === 'error').length,
    warn: entries.filter(e => e.level === 'warn').length,
    info: entries.filter(e => e.level === 'info').length,
    debug: entries.filter(e => e.level === 'debug').length
  }

  return (
    <div className="safe-top safe-bottom animate-in" style={{
      position: 'fixed', inset: 0,
      background: 'var(--bg)',
      zIndex: 500,
      display: 'flex', flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border)', background: 'var(--card-bg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
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
            <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>DIAG_LOGS</div>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>诊断日志</div>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
            <div style={{ color: counts.error > 0 ? 'var(--danger)' : 'inherit' }}>{counts.error} ERR</div>
            <div style={{ color: counts.warn > 0 ? 'var(--warning)' : 'inherit' }}>{counts.warn} WARN</div>
          </div>
        </div>

        {/* 筛选 + 操作 */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {(['all', 'error', 'warn', 'info', 'debug'] as const).map(lv => (
            <button
              key={lv}
              onClick={() => setFilterLevel(lv)}
              style={{
                padding: '4px 10px', borderRadius: 100,
                background: filterLevel === lv ? 'var(--fg)' : 'var(--bg-alt)',
                color: filterLevel === lv ? 'var(--bg)' : 'var(--muted)',
                border: 'none', fontSize: 10, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'DM Mono, monospace'
              }}
            >
              {lv === 'all' ? `全部 ${entries.length}` : `${LEVEL_LABELS[lv]} ${counts[lv]}`}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button onClick={handleExport} style={{
            padding: '4px 10px', borderRadius: 100,
            background: 'var(--bg-alt)', color: 'var(--fg)',
            border: '1px solid var(--border)', fontSize: 10, fontWeight: 600, cursor: 'pointer'
          }}>导出</button>
          <button onClick={handleClear} style={{
            padding: '4px 10px', borderRadius: 100,
            background: 'var(--bg-alt)', color: 'var(--danger)',
            border: '1px solid var(--border)', fontSize: 10, fontWeight: 600, cursor: 'pointer'
          }}>清空</button>
        </div>
      </div>

      {/* 日志列表 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>
            <div style={{ fontSize: 13 }}>暂无日志</div>
          </div>
        )}
        {filtered.map(e => (
          <div key={e.id} style={{
            padding: '8px 10px', marginBottom: 6,
            borderRadius: 8,
            background: 'var(--card-bg)',
            borderLeft: `3px solid ${LEVEL_COLORS[e.level]}`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{
                fontSize: 9, fontWeight: 700, color: LEVEL_COLORS[e.level],
                fontFamily: 'DM Mono, monospace',
                padding: '1px 6px', borderRadius: 4,
                background: 'var(--bg-alt)'
              }}>{LEVEL_LABELS[e.level]}</span>
              <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>{fmtTime(e.ts)}</span>
              <span style={{
                fontSize: 9, color: 'var(--muted)',
                fontFamily: 'DM Mono, monospace',
                padding: '1px 6px', borderRadius: 4,
                background: 'var(--bg-alt)'
              }}>{e.module}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg)', lineHeight: 1.4, wordBreak: 'break-word' }}>{e.message}</div>
            {e.context !== undefined && (
              <pre style={{
                fontSize: 9, color: 'var(--muted)',
                fontFamily: 'DM Mono, monospace',
                margin: '4px 0 0', padding: '4px 6px',
                background: 'var(--bg-alt)', borderRadius: 4,
                overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all'
              }}>{JSON.stringify(e.context, null, 1)}</pre>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
