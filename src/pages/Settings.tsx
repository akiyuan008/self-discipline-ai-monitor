import { useStore } from '@/stores/useStore'
import { showToast } from '@/components/Toast'

interface Props {
  onBack: () => void
}

export default function Settings({ onBack }: Props) {
  const isDark = useStore(s => s.isDark)
  const toggleDark = useStore(s => s.toggleDark)
  const ai = useStore(s => s.ai)
  const setAI = useStore(s => s.setAI)
  const playerTag = useStore(s => s.playerTag)
  const reset = useStore(s => s.reset)

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
        <Header onBack={onBack} title="系统设置" subtitle="SYSTEM_CONFIG" />

        {/* 显示设置 */}
        <Section title="显示">
          <Row title="深色模式" desc="保护夜战视力">
            <div
              className={`switch ${isDark ? 'on' : ''}`}
              onClick={toggleDark}
              role="switch"
              aria-checked={isDark}
            />
          </Row>
        </Section>

        {/* AI 监管者配置 */}
        <Section title="AI 监管者">
          <div className="card" style={{ padding: 16, borderRadius: 12 }}>
            <Field
              label="API Key"
              placeholder="请输入 API Key"
              value={ai.apiKey}
              onChange={(v) => setAI({ ...ai, apiKey: v })}
              type="password"
            />
            <Field
              label="Endpoint"
              placeholder="https://open.bigmodel.cn/api/paas/v4"
              value={ai.endpoint}
              onChange={(v) => setAI({ ...ai, endpoint: v })}
              mono
            />
            <Field
              label="Model"
              placeholder="glm-4-plus"
              value={ai.model}
              onChange={(v) => setAI({ ...ai, model: v })}
              mono
            />
            <button
              onClick={() => {
                showToast('已保存')
                onBack()
              }}
              style={{
                width: '100%', marginTop: 12,
                padding: '12px', borderRadius: 100,
                background: 'var(--fg)', color: 'var(--bg)',
                border: 'none', fontSize: 13, fontWeight: 600
              }}
            >
              保存配置
            </button>
          </div>
        </Section>

        {/* 玩家信息 */}
        <Section title="账户">
          <div className="card" style={{
            padding: 16, borderRadius: 12,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{playerTag}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
                本地账户 · 数据存于设备
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--success)', fontFamily: 'DM Mono, monospace' }}>
              ACTIVE
            </div>
          </div>
        </Section>

        {/* 危险 */}
        <Section title="危险区">
          <button
            onClick={() => {
              if (window.confirm('确定重置全部进度？此操作不可逆。')) {
                reset()
                showToast('已重置')
              }
            }}
            style={{
              width: '100%', padding: 14, borderRadius: 12,
              background: 'transparent',
              border: `1px solid var(--danger)`,
              color: 'var(--danger)', fontSize: 13, fontWeight: 600
            }}
          >
            重置全部进度
          </button>
        </Section>

        <div style={{
          textAlign: 'center', padding: '24px 0',
          fontSize: 10, color: 'var(--muted)', fontFamily: 'DM Mono, monospace'
        }}>
          CYBER SURVIVAL · v1.0.0<br />
          React + Capacitor + z-ai-web-dev-sdk
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        fontSize: 11, color: 'var(--muted)',
        fontFamily: 'DM Mono, monospace',
        marginBottom: 8, paddingLeft: 4
      }}>
        {title.toUpperCase()}
      </div>
      {children}
    </div>
  )
}

function Row({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{
      padding: '14px 16px', borderRadius: 12,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center'
    }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{title}</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{desc}</div>
      </div>
      {children}
    </div>
  )
}

function Field({
  label, placeholder, value, onChange, type = 'text', mono = false
}: {
  label: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  type?: string
  mono?: boolean
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        fontSize: 11, color: 'var(--muted)',
        fontFamily: 'DM Mono, monospace',
        marginBottom: 6
      }}>
        {label.toUpperCase()}
      </div>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%', padding: '10px 12px',
          background: 'var(--bg)', color: 'var(--fg)',
          border: '1px solid var(--border)',
          borderRadius: 8, fontSize: 13,
          fontFamily: mono ? 'DM Mono, monospace' : 'inherit',
          outline: 'none'
        }}
      />
    </div>
  )
}

function Header({ onBack, title, subtitle }: { onBack: () => void; title: string; subtitle: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
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
          {subtitle}
        </div>
        <div style={{ fontSize: 22, fontWeight: 700 }}>{title}</div>
      </div>
    </div>
  )
}
