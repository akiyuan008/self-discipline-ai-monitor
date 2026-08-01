import { useState } from 'react'
import { useStore } from '@/stores/useStore'
import { showToast } from '@/components/Toast'
import ModelPicker from '@/components/ModelPicker'
import { MODEL_PRESETS } from '@/data/modelPresets'

interface Props {
  onBack: () => void
}

export default function Settings({ onBack }: Props) {
  const isDark = useStore(s => s.isDark)
  const toggleDark = useStore(s => s.toggleDark)
  const ai = useStore(s => s.ai)
  const setAI = useStore(s => s.setAI)
  const playerTag = useStore(s => s.playerTag)
  const dailyGoalMin = useStore(s => s.dailyGoalMin)
  const dungeonDurationMin = useStore(s => s.dungeonDurationMin)
  const setDailyGoal = useStore(s => s.setDailyGoal)
  const setDungeonDuration = useStore(s => s.setDungeonDuration)
  const reset = useStore(s => s.reset)

  // 用 local state 缓存输入，避免每次 onChange 触发整个 store 重渲染（修闪退）
  const [apiKey, setApiKey] = useState(ai.apiKey)
  const [endpoint, setEndpoint] = useState(ai.endpoint)
  const [model, setModel] = useState(ai.model)
  const [showPicker, setShowPicker] = useState(false)

  function save() {
    setAI({ apiKey: apiKey.trim(), endpoint: endpoint.trim(), model: model.trim() })
    showToast('已保存')
    onBack()
  }

  // 找当前选中的供应商
  const activePreset = MODEL_PRESETS.find(p => p.endpoint === endpoint)

  if (showPicker) {
    return (
      <ModelPicker
        currentEndpoint={endpoint}
        currentModel={model}
        onSelect={(ep, m) => {
          setEndpoint(ep)
          setModel(m)
          showToast('已切换模型')
        }}
        onClose={() => setShowPicker(false)}
      />
    )
  }

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

        {/* 番茄钟 + 学习目标 */}
        <Section title="玩法参数">
          <div className="card" style={{ padding: 16, borderRadius: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace', marginBottom: 8 }}>
              DAILY_GOAL_MIN
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
              {[60, 120, 180, 240, 360].map(m => (
                <button
                  key={m}
                  onClick={() => { setDailyGoal(m); showToast(`目标设为 ${m} 分钟`) }}
                  style={{
                    flex: 1, padding: '8px',
                    background: dailyGoalMin === m ? 'var(--fg)' : 'var(--bg-alt)',
                    color: dailyGoalMin === m ? 'var(--bg)' : 'var(--muted)',
                    border: 'none', borderRadius: 8,
                    fontSize: 12, fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  {m}m
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace', marginBottom: 8 }}>
              DUNGEON_DURATION_MIN
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[5, 15, 25, 50].map(m => (
                <button
                  key={m}
                  onClick={() => { setDungeonDuration(m); showToast(`番茄钟设为 ${m} 分钟`) }}
                  style={{
                    flex: 1, padding: '8px',
                    background: dungeonDurationMin === m ? 'var(--fg)' : 'var(--bg-alt)',
                    color: dungeonDurationMin === m ? 'var(--bg)' : 'var(--muted)',
                    border: 'none', borderRadius: 8,
                    fontSize: 12, fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  {m}m
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* AI 监管者配置 */}
        <Section title="AI 监管者">
          <div className="card" style={{ padding: 16, borderRadius: 12 }}>
            {/* 模型选择按钮 */}
            <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace', marginBottom: 6 }}>
              MODEL_PROVIDER
            </div>
            <button
              onClick={() => setShowPicker(true)}
              style={{
                width: '100%', padding: '12px 14px',
                background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: 8, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 12
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                {activePreset && (
                  <div style={{
                    width: 24, height: 24, borderRadius: 6,
                    background: activePreset.accent,
                    color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 10, flexShrink: 0
                  }}>
                    {activePreset.emoji}
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 600,
                    color: 'var(--fg)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                  }}>
                    {activePreset ? `${activePreset.vendor} · ${model || '未选模型'}` : '选择供应商和模型'}
                  </div>
                  <div style={{
                    fontSize: 10, color: 'var(--muted)',
                    fontFamily: 'DM Mono, monospace'
                  }}>
                    {endpoint || '点击右侧选择'}
                  </div>
                </div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>

            <Field
              label="API Key"
              placeholder="sk-..."
              value={apiKey}
              onChange={setApiKey}
              type="password"
            />

            <Field
              label="Endpoint"
              placeholder="https://open.bigmodel.cn/api/paas/v4"
              value={endpoint}
              onChange={setEndpoint}
              mono
            />

            <Field
              label="Model"
              placeholder="glm-4-plus"
              value={model}
              onChange={setModel}
              mono
            />

            {/* 状态提示 */}
            {(!apiKey.trim() || !endpoint.trim() || !model.trim()) && (
              <div style={{
                padding: '8px 12px',
                background: 'rgba(245, 158, 11, 0.1)',
                color: 'var(--warning)',
                borderRadius: 8,
                fontSize: 11,
                marginBottom: 12,
                fontFamily: 'DM Mono, monospace'
              }}>
                ⚠ 三项缺一不可。配置完成后监管者才能真正对话与调用工具。
              </div>
            )}

            <button
              onClick={save}
              style={{
                width: '100%', marginTop: 4,
                padding: '12px', borderRadius: 100,
                background: 'var(--fg)', color: 'var(--bg)',
                border: 'none', fontSize: 13, fontWeight: 600,
                cursor: 'pointer'
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
              color: 'var(--danger)', fontSize: 13, fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            重置全部进度
          </button>
        </Section>

        <div style={{
          textAlign: 'center', padding: '24px 0',
          fontSize: 10, color: 'var(--muted)', fontFamily: 'DM Mono, monospace'
        }}>
          CYBER SURVIVAL · v2.3.0<br />
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
