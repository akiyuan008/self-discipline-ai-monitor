import { useState, useRef, useEffect } from 'react'
import { useStore, PRESET_AI_CONFIG } from '@/stores/useStore'
import { showToast } from '@/components/Toast'
import { testConnection } from '@/lib/ai'
import { exportBackup, importBackup } from '@/lib/backup'
import { useClassTaskStore } from '@/stores/classTaskStore'

interface Props {
  onBack: () => void
  onNavigateDiagLogs?: () => void
}

export default function Settings({ onBack, onNavigateDiagLogs }: Props) {
  const isDark = useStore(s => s.isDark)
  const toggleDark = useStore(s => s.toggleDark)
  const ai = useStore(s => s.ai)
  const setAI = useStore(s => s.setAI)
  const ai2 = useStore(s => s.ai2)
  const setAI2 = useStore(s => s.setAI2)
  const aiMode = useStore(s => s.aiMode)
  const setAIMode = useStore(s => s.setAIMode)
  const playerTag = useStore(s => s.playerTag)
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
  const [apiKey2, setApiKey2] = useState(ai2.apiKey || '')
  const [endpoint2, setEndpoint2] = useState(ai2.endpoint || '')
  const [model2, setModel2] = useState(ai2.model || '')
  const [systemPrompt, setSystemPromptLocal] = useState(storedSystemPrompt)
  const [testing, setTesting] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')
  const [testMsg, setTestMsg] = useState('')
  const [fetchingModels, setFetchingModels] = useState(false)
  const [gaokaoDateInput, setGaokaoDateInput] = useState(gaokaoDate)
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false)
  const [modelSearch, setModelSearch] = useState('')
  const [importing, setImporting] = useState(false)
  const notifSetting = useClassTaskStore(s => s.notificationSetting)
  const setNotif = useClassTaskStore(s => s.setNotification)
  const fileRef = useRef<HTMLInputElement>(null)
  // 同步 store 的 ai 变化到本地 state（从其他页面返回或 rehydrate 时）
  useEffect(() => {
    setApiKey(ai.apiKey || '')
    setEndpoint(ai.endpoint || '')
    setModel(ai.model || '')
    setApiKey2(ai2.apiKey || '')
    setEndpoint2(ai2.endpoint || '')
    setModel2(ai2.model || '')
  }, [ai.apiKey, ai.endpoint, ai.model, ai2.apiKey, ai2.endpoint, ai2.model])


  // 保存：先存 localStorage（通过 store persist），再异步测试
  // 测试失败只弹 Toast，绝对不清空表单
  function save() {
    setAI({ apiKey: apiKey.trim(), endpoint: endpoint.trim(), model: model.trim() })
    setAI2({ apiKey: apiKey2.trim(), endpoint: endpoint2.trim(), model: model2.trim() })
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
    const base = endpoint.trim().replace(/\/+$/, '')

    // 尝试多个端点格式：OpenAI /v1/models、Ollama /api/tags、直接 /models
    const urls: string[] = []
    if (/\/v\d+$/.test(base)) {
      urls.push(base + '/models')
    } else {
      urls.push(base + '/v1/models')
      urls.push(base + '/api/tags')
      urls.push(base + '/models')
    }

    let lastErr = ''
    for (const url of urls) {
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 10000)

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
          lastErr = `${res.status}: ${detail || res.statusText}`
          continue
        }

        const data = await res.json()
        // 支持多种返回格式
        let ids: string[] = []
        if (Array.isArray(data.data)) {
          // OpenAI 格式: { data: [{ id: "model-name" }, ...] }
          ids = data.data.map((m: any) => m.id || m.name).filter(Boolean)
        } else if (Array.isArray(data.models)) {
          // 某些代理格式
          ids = data.models.map((m: any) => m.id || m.name || m).filter(Boolean)
        } else if (data.models && typeof data.models === 'object') {
          // Ollama /api/tags 格式: { models: [{ name: "xxx" }, ...] }
          ids = Object.values(data.models).map((m: any) => m.name || m.id || m.model || String(m)).filter(Boolean)
        } else if (Array.isArray(data)) {
          // 某些直接返回数组的端点
          ids = data.map((m: any) => m.id || m.name || String(m)).filter(Boolean)
        }

        if (ids.length === 0) {
          lastErr = '返回的模型列表为空'
          continue
        }

        setModelList(ids)
        if (!ids.includes(model)) {
          setModel(ids[0])
          setAI({ model: ids[0] })
        }
        showToast(`已获取 ${ids.length} 个模型`)
        setFetchingModels(false)
        return
      } catch (e: any) {
        if (e.name === 'AbortError') {
          lastErr = '请求超时（10s）'
        } else {
          lastErr = e.message
        }
      }
    }

    setFetchingModels(false)
    showToast(`获取模型列表失败，${lastErr}。你可以手动输入模型名。`)
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

        {/* 通知设置 */}
        <Section title="通知提醒">
          <Row title="提醒铃声" desc="课程提醒时播放铃声">
            <div
              className={`switch ${notifSetting.sound ? 'on' : ''}`}
              onClick={() => setNotif({ sound: !notifSetting.sound })}
            />
          </Row>
          <Row title="震动" desc="课程提醒时震动">
            <div
              className={`switch ${notifSetting.vibration ? 'on' : ''}`}
              onClick={() => setNotif({ vibration: !notifSetting.vibration })}
            />
          </Row>
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

            {/* Model — 自定义可搜索下拉框 + 获取模型列表按钮 */}
            <div style={{ marginBottom: 12 }}>
              <div style={{
                fontSize: 11, color: 'var(--muted)',
                fontFamily: 'DM Mono, monospace',
                marginBottom: 6
              }}>
                MODEL
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  {/* 触发按钮 */}
                  <button
                    onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                    style={{
                      width: '100%', padding: '10px 12px',
                      background: 'var(--bg)', color: 'var(--fg)',
                      border: '1px solid var(--border)',
                      borderRadius: 8, fontSize: 13,
                      fontFamily: 'DM Mono, monospace',
                      cursor: 'pointer',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      gap: 8
                    }}
                  >
                    <span style={{
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                      {model || '选择模型'}
                    </span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" style={{ flexShrink: 0, transition: 'transform 0.2s', transform: modelDropdownOpen ? 'rotate(180deg)' : 'none' }}>
                      <path d="M15 18l-6-6 6-6" />
                    </svg>
                  </button>

                  {/* 下拉面板 */}
                  {modelDropdownOpen && (
                    <>
                      {/* 点击外部关闭 */}
                      <div
                        style={{ position: 'fixed', inset: 0, zIndex: 998 }}
                        onClick={() => { setModelDropdownOpen(false); setModelSearch('') }}
                      />
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0,
                        marginTop: 4, zIndex: 999,
                        background: 'var(--card-bg)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        overflow: 'hidden',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.15)'
                      }}>
                        {/* 搜索框 */}
                        <input
                          type="text"
                          value={modelSearch}
                          onChange={(e) => setModelSearch(e.target.value)}

                          placeholder="搜索模型…"
                          autoFocus
                          style={{
                            width: '100%', padding: '10px 12px',
                            background: 'var(--bg)', color: 'var(--fg)',
                            border: 'none', borderBottom: '1px solid var(--border)',
                            fontSize: 13, outline: 'none',
                            boxSizing: 'border-box'
                          }}
                        />
                        {/* 模型列表 */}
                        <div style={{ maxHeight: 200, overflowY: 'auto' }} className="scrollbar-hide">
                          {modelList.filter(m =>
                            m.toLowerCase().includes(modelSearch.toLowerCase())
                          ).length === 0 ? (
                            <div style={{ padding: '16px', fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
                              {modelList.length === 0 ? '暂无模型，点击「获取模型列表」' : '无匹配模型'}
                            </div>
                          ) : modelList.filter(m =>
                            m.toLowerCase().includes(modelSearch.toLowerCase())
                          ).map(m => (
                            <button
                              key={m}
                              onClick={() => {
                                setModel(m)
                                setModelDropdownOpen(false)
                                setModelSearch('')
                              }}
                              style={{
                                width: '100%', padding: '10px 12px',
                                background: m === model ? 'var(--bg-alt)' : 'transparent',
                                color: m === model ? 'var(--fg)' : 'var(--muted)',
                                border: 'none', fontSize: 13,
                                fontFamily: 'DM Mono, monospace',
                                cursor: 'pointer', textAlign: 'left',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                transition: 'background 0.15s'
                              }}
                              onMouseEnter={(e) => { if (m !== model) e.currentTarget.style.background = 'var(--bg-alt)' }}
                              onMouseLeave={(e) => { if (m !== model) e.currentTarget.style.background = 'transparent' }}
                            >
                              <span>{m}</span>
                              {m === model && <span style={{ color: 'var(--success)', fontSize: 14 }}>✓</span>}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
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
                  lineHeight: 1.6,
                  touchAction: 'manipulation',
                  WebkitUserSelect: 'text',
                  userSelect: 'text',
                  WebkitTouchCallout: 'default'
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

        {/* AI 模式 */}
        <Section title="AI 模式">
          <div className="card" style={{ padding: 16, borderRadius: 12 }}>
            <Row title="双 AI 模式" desc="开启后，二号AI用于课程打卡照片验证">
              <div
                className={`switch ${aiMode === 'dual' ? 'on' : ''}`}
                onClick={() => setAIMode(aiMode === 'dual' ? 'single' : 'dual')}
              />
            </Row>
            {aiMode === 'dual' && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.6 }}>
                  二号 AI 配置（用于照片验证）
                </div>
                <Field label="二号 API Key" placeholder="sk-..." value={apiKey2} onChange={setApiKey2} type="password" />
                <Field label="二号 Base URL" placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1" value={endpoint2} onChange={setEndpoint2} mono />
                <Field label="二号 Model" placeholder="qwen-vl-plus" value={model2} onChange={setModel2} mono />
                <button onClick={save} style={{
                  width: '100%', padding: '10px', borderRadius: 8,
                  background: 'var(--fg)', color: 'var(--bg)',
                  border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer'
                }}>保存二号AI配置</button>
              </div>
            )}
          </div>
        </Section>

        {/* 账户与版本 */}
        <Section title="账户">
          <div className="card" style={{
            padding: 16, borderRadius: 12,
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 12, paddingBottom: 12,
              borderBottom: '1px solid var(--border)'
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
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Cyber Survival</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
                v2.5.0 · LOCAL · OFFLINE
              </div>
            </div>
          </div>
        </Section>

        {/* 诊断日志 */}
        <Section title="诊断">
          <button
            onClick={() => onNavigateDiagLogs?.()}
            className="card"
            style={{
              width: '100%', padding: '14px 16px', borderRadius: 12,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              cursor: 'pointer', textAlign: 'left',
              background: 'var(--card-bg)', border: '1px solid var(--border)'
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--fg)' }}>诊断日志</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>查看运行日志、导出问题报告</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
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

        {/* 数据备份 */}
        <Section title="数据备份">
          <div className="card" style={{ padding: 16, borderRadius: 12 }}>
            <div style={{
              fontSize: 12, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.6
            }}>
              导出全部数据（HP、积分、任务、成就、AI 配置、高考档案等）到文件，或从备份文件恢复。
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={async () => {
                  try {
                    await exportBackup()
                  } catch {
                    showToast('导出失败，请重试')
                  }
                }}
                style={{
                  flex: 1, padding: '12px', borderRadius: 100,
                  background: 'var(--fg)', color: 'var(--bg)',
                  border: 'none', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                导出备份
              </button>
              <button
                onClick={() => importing ? {} : fileRef.current?.click()}
                disabled={importing}
                style={{
                  flex: 1, padding: '12px', borderRadius: 100,
                  background: 'var(--bg-alt)', color: 'var(--fg)',
                  border: '1px solid var(--border)',
                  fontSize: 13, fontWeight: 600,
                  cursor: importing ? 'not-allowed' : 'pointer',
                  opacity: importing ? 0.5 : 1
                }}
              >
                {importing ? '导入中…' : '导入备份'}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (!file) return
                  setImporting(true)
                  try {
                    await importBackup(file)
                  } catch (err: any) {
                    showToast(err?.message || '导入失败')
                  } finally {
                    // importBackup may call window.location.reload(), but
                    // in environments where it doesn't, ensure we reset the flag.
                    setImporting(false)
                  }
                }}
                style={{ display: 'none' }}
              />
            </div>
          </div>
        </Section>

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
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>{title}</div>
      </div>
    </div>
  )
}
