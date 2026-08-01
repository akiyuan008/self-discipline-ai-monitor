import { useState } from 'react'
import { MODEL_PRESETS, type ModelPreset } from '@/data/modelPresets'

interface Props {
  onSelect: (endpoint: string, model: string) => void
  onClose: () => void
  currentEndpoint: string
  currentModel: string
}

export default function ModelPicker({ onSelect, onClose, currentEndpoint, currentModel }: Props) {
  const [selectedPreset, setSelectedPreset] = useState<ModelPreset | null>(null)

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'var(--bg)',
        zIndex: 600,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}
      className="safe-top safe-bottom animate-in"
    >
      {/* Header */}
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
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
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
            MODEL_PICKER
          </div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>选择 AI 供应商</div>
        </div>
      </div>

      {/* 卡片网格 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 24px' }} className="scrollbar-hide">
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10
        }}>
          {MODEL_PRESETS.map(p => {
            const isActive = p.endpoint === currentEndpoint
            return (
              <button
                key={p.id}
                onClick={() => setSelectedPreset(p)}
                style={{
                  textAlign: 'left',
                  padding: 12,
                  borderRadius: 14,
                  background: 'var(--card-bg)',
                  border: isActive ? `2px solid ${p.accent}` : '1px solid var(--border)',
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {p.featured && (
                  <div style={{
                    position: 'absolute', top: 6, right: 6,
                    fontSize: 9, fontWeight: 700,
                    background: p.accent, color: '#fff',
                    padding: '2px 6px', borderRadius: 4
                  }}>
                    推荐
                  </div>
                )}
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: p.accent, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 13,
                  marginBottom: 10
                }}>
                  {p.logoText}
                </div>
                <div style={{
                  fontSize: 14, fontWeight: 600,
                  color: 'var(--fg)',
                  marginBottom: 2
                }}>
                  {p.vendor}
                </div>
                <div style={{
                  fontSize: 11, color: 'var(--muted)',
                  lineHeight: 1.4
                }}>
                  {p.tagline}
                </div>
                {isActive && (
                  <div style={{
                    fontSize: 10, color: p.accent,
                    marginTop: 6, fontFamily: 'DM Mono, monospace', fontWeight: 600
                  }}>
                    当前: {currentModel}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* 底部 Sheet 选模型 */}
      {selectedPreset && (
        <div
          style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 700,
            display: 'flex',
            alignItems: 'flex-end'
          }}
          onClick={() => setSelectedPreset(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxHeight: '80vh',
              background: 'var(--bg)',
              borderRadius: '20px 20px 0 0',
              padding: 16,
              overflowY: 'auto',
              animation: 'fadeInUp 0.3s ease-out'
            }}
            className="scrollbar-hide safe-bottom"
          >
            {/* 抓手 */}
            <div style={{
              width: 40, height: 4,
              background: 'var(--border)',
              borderRadius: 2,
              margin: '0 auto 16px'
            }} />

            {/* 供应商信息 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: selectedPreset.accent,
                color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 15
              }}>
                {selectedPreset.logoText}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{selectedPreset.vendor}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{selectedPreset.tagline}</div>
              </div>
            </div>

            {/* 申请 API Key */}
            {selectedPreset.getApiKeyUrl && (
              <a
                href={selectedPreset.getApiKeyUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'block',
                  padding: '10px 14px',
                  background: 'var(--bg-alt)',
                  color: 'var(--fg)',
                  borderRadius: 10,
                  fontSize: 12,
                  marginBottom: 16,
                  textDecoration: 'none',
                  textAlign: 'center',
                  fontWeight: 600
                }}
              >
                前往 {selectedPreset.vendor} 申请 API Key →
              </a>
            )}

            {/* Endpoint 提示 */}
            {selectedPreset.endpoint && (
              <div style={{
                padding: '8px 12px',
                background: 'var(--bg-alt)',
                borderRadius: 8,
                marginBottom: 16,
                fontSize: 10, fontFamily: 'DM Mono, monospace',
                color: 'var(--muted)',
                wordBreak: 'break-all'
              }}>
                ENDPOINT: {selectedPreset.endpoint}
              </div>
            )}

            {/* 模型列表 */}
            <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace', marginBottom: 8 }}>
              选择模型
            </div>
            {selectedPreset.models.map(m => {
              const selected = selectedPreset.endpoint === currentEndpoint && m.id === currentModel
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    onSelect(selectedPreset.endpoint, m.id)
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    background: selected ? 'var(--fg)' : 'var(--card-bg)',
                    color: selected ? 'var(--bg)' : 'var(--fg)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    marginBottom: 8,
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 14, fontWeight: 600,
                      marginBottom: 2,
                      display: 'flex', alignItems: 'center', gap: 6
                    }}>
                      {m.name}
                      {m.tags?.map(t => (
                        <span key={t} style={{
                          fontSize: 9, padding: '1px 5px',
                          borderRadius: 3,
                          background: selected ? 'rgba(255,255,255,0.2)' : 'var(--bg-alt)',
                          color: selected ? '#fff' : 'var(--muted)',
                          fontWeight: 600
                        }}>
                          {t}
                        </span>
                      ))}
                    </div>
                    <div style={{
                      fontSize: 11,
                      color: selected ? 'rgba(255,255,255,0.7)' : 'var(--muted)'
                    }}>
                      {m.desc}
                    </div>
                  </div>
                  {selected && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              )
            })}

            {/* 自定义供应商：让用户直接输入 endpoint 和 model */}
            {selectedPreset.id === 'custom' && (
              <div style={{ marginTop: 12 }}>
                <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
                  选「自定义」后回到设置页，手动填入 endpoint 和 model 名称。任何兼容 OpenAI 协议的服务都可以接入。
                </p>
                <button
                  onClick={() => onSelect('', 'custom')}
                  style={{
                    width: '100%', padding: 12,
                    background: 'var(--fg)', color: 'var(--bg)',
                    border: 'none', borderRadius: 10,
                    fontSize: 13, fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  返回手填
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
