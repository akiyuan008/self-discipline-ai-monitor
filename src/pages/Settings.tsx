import { useState } from 'react'
import { useStore, PRESET_AI_CONFIG } from '@/stores/useStore'
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
  const storedSystemPrompt = useStore(s => s.systemPrompt)
  const modelList = useStore(s => s.modelList)
  const setSystemPrompt = useStore(s => s.setSystemPrompt)
  const setModelList = useStore(s => s.setModelList)
  const gaokaoDate = useStore(s => s.gaokaoDate)
  const gaokaoTargetScore = useStore(s => s.gaokaoTargetScore)
  const gaokaoBaseScore = useStore(s => s.gaokaoBaseScore)
  const setGaokaoDate = useStore(s => s.setGaokaoDate)
  const setGaokaoTargetScore = useStore(s => s.setGaokaoTargetScore)

  // local state — 仅挂载时从 store 读取，不使用 useEffect 反向同步
  const [apiKey, setApiKey] = useState(ai.apiKey || PRESET_AI_CONFIG.apiKey)
  const [endpoint, setEndpoint] = useState(ai.endpoint || PRESET_AI_CONFIG.endpoint)
  const [model, setModel] = useState(ai.model || PRESET_AI_CONFIG.model)
  const [systemPrompt, setSystemPromptLocal] = useState(storedSystemPrompt)
  const [testing, setTesting] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')
  const [testMsg, setTestMsg] = useState('')
  const [fetchingModels, setFetchingModels] = useState(false)
  const [gaokaoDateInput, setGaokaoDateInput] = useState(gaokaoDate)

  // 保存：先存 localStorage（通过 store persist），再异步测试
  // 测试失败只弹 Toast，绝对不清空表单
  function save() {
    setAI({ apiKey: apiKey.trim(), endpoint: endpoint.trim(), model: model.trim() })
    setSystemPrompt(systemPrompt)
    showToast('配置已保存')
  }

  async function saveAndTest() {
    const cfg = { apiKey: apiKey.trim(), endpoint: endpoint.trim(), model: model.trim() }
    // 先存入 localStorage
    setAI(cfg)
    setSystemPrompt(systemPrompt)
    showToast('配置已保存，正在测试连接…')

    setTesting('testing')
    setTestMsg('')
    const r = await testConnection(cfg)
    setTesting(r.ok ? 'ok' : 'fail')
    setTestMsg(r.msg)
    if (r.ok) showToast('连接成功，监管者已就绪')
    else showToast('连接失败：' + r.msg)
    // 不清空表单 — local state 保持不变
  }

  // 获取模型列表：调用 ${baseUrl}/v1/models
  async function fetchModels() {
    const baseUrl = endpoint.trim().replace(/\/+$/, '')
    if (!baseUrl) {
      showToast('请先填写 Base URL')
      return
    }
    if (!apiKey.trim()) {
      showToast('请先填写 API Key')
      return
    }

    setFetchingModels(true)
    // 智能拼接 models URL：endpoint 以 /v1 结尾则直接追加 /models，否则追加 /v1/models
    const base = endpoint.trim().replace(/\/+$/, '')
    const url = /\/v\d+$/.test(base) ? base + '/models' : base + '/v1/models'

    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 15000)

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      })
      clearTimeout(timer)

      if (!res.ok) {
        let detail = ''
        try { detail = (await res.json())?.error?.message || '' } catch { /* ignore */ }
        showToast(`获取失败 (${res.status})：${detail || res.statusText}`)
        return
      }

      const data = await res.json()
      // OpenAI 格式: { data: [{ id: "model-name" }, ...] }
      const ids: string[] = (data.data || data.models || [])
        .map((m: any) => m.id || m.name)
        .filter(Boolean)

      if (ids.length === 0) {
        showToast('返回的模型列表为空')
        return
      }

      setModelList(ids)
      // 如果当前选中的模型不在新列表中，自动切到第一个
      if (!ids.includes(model)) {
        setModel(ids[0])
        setAI({ model: ids[0] })
      }
      showToast(`已获取 ${ids.length} 个模型`)
    } catch (e: any) {
      if (e.name === 'AbortError') showToast('请求超时（15s）')
      else showToast('网络错误：' + e.message)
    } finally {
      setFetchingModels(false)
    }
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

        {/* 高考目标配置 */}
        <Section title="高考目标">
          <div className="card" style={{ padding: 16, borderRadius: 12 }}>
            <div style={{
              fontSize: 12, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.6
            }}>
              设定高考日期和目标分数。学习、完成任务会让估分上升，娱乐会让估分下降。
            </div>

            {/* 高考日期 */}
            <div style={{ marginBottom: 16 }}>
              <div style={{
                fontSize: 11, color: 'var(--muted)',
                fontFamily: 'DM Mono, monospace',
                marginBottom: 6
              }}>
                GAOKAO_DATE
              </div>
              <input
                type="date"
                value={gaokaoDateInput}
                onChange={(e) => setGaokaoDateInput(e.target.value)}
                onBlur={() => {
                  if (gaokaoDateInput && gaokaoDateInput !== gaokaoDate) {
                    setGaokaoDate(gaokaoDateInput)
                    showToast('高考日期已更新')
                  }
                }}
                style={{
                  width: '100%', padding: '10px 12px',
                  background: 'var(--bg)', color: 'var(--fg)',
                  border: '1px solid var(--border)',
                  borderRadius: 8, fontSize: 13,
                  fontFamily: 'DM Mono, monospace',
                  outline: 'none'
                }}
              />
            </div>

            {/* 目标分数 */}
            <div style={{ marginBottom: 16 }}>
              <div style={{
                fontSize: 11, color: 'var(--muted)',
                fontFamily: 'DM Mono, monospace',
                marginBottom: 6
              }}>
                TARGET_SCORE
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[600, 650, 680, 700, 750].map(s => (
                  <button
                    key={s}
                    onClick={() => {
                      setGaokaoTargetScore(s)
                      showToast(`目标分数设为 ${s}`)
                    }}
                    style={{
                      flex: 1, padding: '8px',
                      background: gaokaoTargetScore === s ? 'var(--fg)' : 'var(--bg-alt)',
                      color: gaokaoTargetScore === s ? 'var(--bg)' : 'var(--muted)',
                      border: 'none', borderRadius: 8,
                      fontSize: 12, fontWeight: 600, cursor: 'pointer'
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* 基础估分（只读展示） */}
            <div style={{
              padding: '10px 12px',
              background: 'var(--bg-alt)',
              borderRadius: 8,
              fontSize: 11, color: 'var(--muted)',
              lineHeight: 1.8
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>基础估分</span>
                <span style={{ color: 'var(--fg)', fontFamily: 'DM Mono, monospace' }}>{gaokaoBaseScore}</span>
              </div>
              <div style={{ fontSize: 10, marginTop: 4 }}>
                基础估分为起步分数，学习每小时 +5，娱乐每小时 -3，完成任务 +3。
              </div>
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

            {/* API Key */}
            <Field
              label="API Key"
              placeholder="sk-..."
              value={apiKey}
              onChange={setApiKey}
              type="password"
            />

            {/* Base URL */}
            <Field
              label="Base URL"
              placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
              value={endpoint}
              onChange={setEndpoint}
              mono
            />

            {/* Model — 下拉框 + 获取模型列表按钮 */}
            <div style={{ marginBottom: 12 }}>
              <div style={{
                fontSize: 11, color: 'var(--muted)',
                fontFamily: 'DM Mono, monospace',
                marginBottom: 6
              }}>
                MODEL
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  style={{
                    flex: 1, padding: '10px 12px',
                    background: 'var(--bg)', color: 'var(--fg)',
                    border: '1px solid var(--border)',
                    borderRadius: 8, fontSize: 13,
                    fontFamily: 'DM Mono, monospace',
                    outline: 'none',
                    cursor: 'pointer',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238a8a8a' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 12px center',
                    paddingRight: 32
                  }}
                >
                  {modelList.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <button
                  onClick={fetchModels}
                  disabled={fetchingModels}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: 'var(--bg-alt)',
                    color: 'var(--fg)',
                    border: '1px solid var(--border)',
                    fontSize: 12, fontWeight: 600,
                    cursor: fetchingModels ? 'wait' : 'pointer',
                    opacity: fetchingModels ? 0.5 : 1,
                    whiteSpace: 'nowrap'
                  }}
                >
                  {fetchingModels ? '获取中…' : '获取模型列表'}
                </button>
              </div>
            </div>

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
              <div>百炼（千问）：https://dashscope.aliyuncs.com/compatible-mode/v1</div>
              <div>DeepSeek：https://api.deepseek.com</div>
              <div>智谱：https://open.bigmodel.cn/api/paas/v4</div>
              <div>Kimi：https://api.moonshot.cn/v1</div>
              <div style={{ marginTop: 6, fontSize: 10, color: 'var(--muted)' }}>
                百炼模型：qwen-plus / qwen-turbo / qwen-max / qwen3.7-max
              </div>
            </div>

            {/* 系统提示词 */}
            <div style={{ marginBottom: 12 }}>
              <div style={{
                fontSize: 11, color: 'var(--muted)',
                fontFamily: 'DM Mono, monospace',
                marginBottom: 6
              }}>
                SYSTEM_PROMPT
              </div>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPromptLocal(e.target.value)}
                rows={10}
                placeholder="输入系统提示词…"
                style={{
                  width: '100%', padding: '10px 12px',
                  background: 'var(--bg)', color: 'var(--fg)',
                  border: '1px solid var(--border)',
                  borderRadius: 8, fontSize: 12,
                  fontFamily: 'inherit',
                  outline: 'none',
                  resize: 'vertical',
                  lineHeight: 1.6
                }}
              />
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
                此提示词将作为 messages[0] 发送给大模型，定义监管者的人格和行为规则。
              </div>
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
                  background: 'var(--bg-alt)', color: 'var(--fg)',
                  border: '1px solid var(--border)',
                  fontSize: 13, fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                保存
              </button>
              <button
                onClick={saveAndTest}
                disabled={testing === 'testing'}
                style={{
                  flex: 2, marginTop: 4,
                  padding: '12px', borderRadius: 100,
                  background: 'var(--fg)', color: 'var(--bg)',
                  border: 'none', fontSize: 13, fontWeight: 600,
                  cursor: testing === 'testing' ? 'wait' : 'pointer',
                  opacity: testing === 'testing' ? 0.5 : 1
                }}
              >
                {testing === 'testing' ? '测试中…' : '保存并测试连接'}
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
          CYBER SURVIVAL · v2.5.0<br />
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
