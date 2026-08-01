import { useState, useEffect } from 'react'
import { useStore } from '@/stores/useStore'
import { showToast } from '@/components/Toast'
import { testConnection } from '@/lib/ai'

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

  // 用 local state 缓存输入，避免每次 onChange 触发整个 store 重渲染
  const [apiKey, setApiKey] = useState(ai.apiKey)
  const [endpoint, setEndpoint] = useState(ai.endpoint)
  const [model, setModel] = useState(ai.model)
  const [testing, setTesting] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')
  const [testMsg, setTestMsg] = useState('')

  // 如果 store 中的 ai 配置变化了（比如从其他页面回来），同步到 local state
  useEffect(() => {
    setApiKey(ai.apiKey)
    setEndpoint(ai.endpoint)
    setModel(ai.model)
  }, [ai.apiKey, ai.endpoint, ai.model])

  function save() {
    setAI({ apiKey: apiKey.trim(), endpoint: endpoint.trim(), model: model.trim() })
    showToast('配置已保存')
  }

  async function test() {
    // 先保存再测试
    setAI({ apiKey: apiKey.trim(), endpoint: endpoint.trim(), model: model.trim() })
    setTesting('testing')
    setTestMsg('')
    const r = await testConnection({ apiKey: apiKey.trim(), endpoint: endpoint.trim(), model: model.trim() })
    setTesting(r.ok ? 'ok' : 'fail')
    setTestMsg(r.msg)
    if (r.ok) showToast('连接成功')
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
            <div style={{
              fontSize: 12, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.6
            }}>
              填入你的 API 信息（兼容 OpenAI 协议的任意大模型均可）。三项缺一不可。
            </div>

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

            {/* 常见 endpoint 参考 */}
            <div style={{
              padding: '10px 12px',
              background: 'var(--bg-alt)',
              borderRadius: 8,
              marginBottom: 12,
              fontSize: 11, color: 'var(--muted)',
              lineHeight: 1.8
            }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>常见 Endpoint 参考：</div>
              <div>智谱：https://open.bigmodel.cn/api/paas/v4</div>
              <div>千问：https://dashscope.aliyuncs.com/compatible-mode/v1</div>
              <div>DeepSeek：https://api.deepseek.com/v1</div>
              <div>Kimi：https://api.moonshot.cn/v1</div>
            </div>

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

            <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={save}
              style={{
                flex: 1, marginTop: 4,
                padding: '12px', borderRadius: 100,
                background: 'var(--fg)', color: 'var(--bg)',
                border: 'none', fontSize: 13, fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              保存配置
            </button>
            <button
              onClick={test}
              disabled={testing === 'testing'}
              style={{
                flex: 1, marginTop: 4,
                padding: '12px', borderRadius: 100,
                background: 'transparent', color: 'var(--fg)',
                border: '1px solid var(--border)',
                fontSize: 13, fontWeight: 600,
                cursor: testing === 'testing' ? 'wait' : 'pointer',
                opacity: testing === 'testing' ? 0.5 : 1
              }}
            >
              {testing === 'testing' ? '测试中…' : '测试连接'}
            </button>
            </div>

          {/* 测试反馈 */}
          {testMsg && (
            <div style={{
              marginTop: 12, padding: '10px 12px', borderRadius: 10,
              background: testing === 'ok' ? 'rgba(22, 163, 74, 0.08)' : 'rgba(229, 77, 46, 0.08)',
              color: testing === 'ok' ? 'var(--success)' : 'var(--danger)',
              fontSize: 12,
              display: 'flex', alignItems: 'center', gap: 6
            }}>
              {testing === 'ok' ? '✓ ' : '✕ '}
              {testMsg}
            </div>
          )}
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
          CYBER SURVIVAL · v2.4.0<br />
          React + Capacitor
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
