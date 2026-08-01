import { useState } from 'react'
import { MODEL_PRESETS } from '@/data/modelPresets'

interface Props {
  onSelect: (endpoint: string, model: string) => void
  onClose: () => void
  currentEndpoint: string
  currentModel: string
}

export default function ModelPicker({ onSelect, onClose, currentEndpoint, currentModel }: Props) {
  const [expanded, setExpanded] = useState<string | null>(
    MODEL_PRESETS.find(p => p.endpoint === currentEndpoint)?.id ?? null
  )

  function pick(endpoint: string, model: string) {
    onSelect(endpoint, model)
    onClose()
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'var(--bg)',
        zIndex: 600,
        overflow: 'auto'
      }}
      className="safe-top safe-bottom animate-in"
    >
      <div style={{ padding: '16px 20px 32px' }}>
        <Header onClose={onClose} />

        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>选择模型供应商</h1>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20 }}>
          共 {MODEL_PRESETS.length} 家国内主流大模型，全部兼容 OpenAI 协议
        </p>

        {MODEL_PRESETS.map(p => {
          const isExpanded = expanded === p.id
          const isActive = currentEndpoint === p.endpoint
          return (
            <div key={p.id} style={{
              marginBottom: 8,
              background: 'var(--card-bg)',
              borderRadius: 12,
              border: `1px solid ${isActive ? p.accent : 'var(--border)'}`,
              overflow: 'hidden'
            }}>
              <button
                onClick={() => setExpanded(isExpanded ? null : p.id)}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  background: 'transparent',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: p.accent,
                  color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 14, flexShrink: 0
                }}>
                  {p.emoji}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg)' }}>
                    {p.vendor}
                  </div>
                  <div style={{
                    fontSize: 11, color: 'var(--muted)',
                    fontFamily: 'DM Mono, monospace',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                  }}>
                    {p.vendorEn} · {p.models.length} 个模型
                  </div>
                </div>
                {isActive && (
                  <div style={{
                    fontSize: 10, color: p.accent,
                    fontWeight: 600,
                    padding: '2px 8px',
                    background: p.accent + '14',
                    borderRadius: 100,
                    fontFamily: 'DM Mono, monospace'
                  }}>
                    ACTIVE
                  </div>
                )}
                <svg
                  width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="var(--muted)" strokeWidth="2"
                  style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {isExpanded && (
                <div style={{ padding: '4px 0 12px' }}>
                  {p.getApiKeyUrl && (
                    <a
                      href={p.getApiKeyUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'block',
                        padding: '8px 16px',
                        fontSize: 12, color: p.accent,
                        textDecoration: 'none'
                      }}
                    >
                      → 获取 {p.vendor} API Key
                    </a>
                  )}
                  {p.models.map(m => {
                    const selected = isActive && currentModel === m.id
                    return (
                      <button
                        key={m.id}
                        onClick={() => pick(p.endpoint, m.id)}
                        style={{
                          width: '100%',
                          padding: '10px 16px 10px 60px',
                          background: selected ? p.accent + '0F' : 'transparent',
                          border: 'none',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                      >
                        <div>
                          <div style={{
                            fontSize: 13, fontWeight: 500,
                            color: selected ? p.accent : 'var(--fg)'
                          }}>
                            {m.name}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                            {m.desc}
                          </div>
                        </div>
                        {selected && (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                            stroke={p.accent} strokeWidth="2.5">
                            <path d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    )
                  })}
                  <div style={{
                    padding: '6px 16px 0 60px',
                    fontSize: 10,
                    color: 'var(--muted)',
                    fontFamily: 'DM Mono, monospace'
                  }}>
                    ENDPOINT: {p.endpoint || '(待自填)'}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Header({ onClose }: { onClose: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
      <button
        onClick={onClose}
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
      <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
        MODEL_PICKER
      </div>
    </div>
  )
}
