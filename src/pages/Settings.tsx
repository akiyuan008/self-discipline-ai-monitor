import { useState, useEffect } from 'react'
import { useStore } from '@/stores/useStore'
import { testConnection } from '@/lib/ai'
import { exportBackup, importBackup } from '@/lib/backup'
import { showToast } from '@/components/Toast'
import type { PageId } from '@/stores/useStore'

interface SettingsProps {
  onNavigate?: (page: PageId) => void
}

export default function Settings({ onNavigate }: SettingsProps) {
  const playerTag = useStore(s => s.playerTag)
  const dailyGoalMin = useStore(s => s.dailyGoalMin)
  const setDailyGoal = useStore(s => s.setDailyGoal)
  const dungeonDurationMin = useStore(s => s.dungeonDurationMin)
  const setDungeonDuration = useStore(s => s.setDungeonDuration)
  const gaokaoDate = useStore(s => s.gaokaoDate)
  const setGaokaoDate = useStore(s => s.setGaokaoDate)
  const gaokaoTargetScore = useStore(s => s.gaokaoTargetScore)
  const setGaokaoTargetScore = useStore(s => s.setGaokaoTargetScore)
  const gaokaoBaseScore = useStore(s => s.gaokaoBaseScore)
  const isDark = useStore(s => s.isDark)
  const toggleDark = useStore(s => s.toggleDark)
  const reset = useStore(s => s.reset)

  // AI 配置
  const ai = useStore(s => s.ai)
  const setAIConfig = useStore(s => s.setAIConfig)
  const systemPrompt = useStore(s => s.systemPrompt)
  const setSystemPrompt = useStore(s => s.setSystemPrompt)

  const [apiKeyInput, setApiKeyInput] = useState(ai.apiKey)
  const [endpointInput, setEndpointInput] = useState(ai.endpoint)
  const [modelInput, setModelInput] = useState(ai.model)
  const [systemPromptInput, setSystemPromptInput] = useState(systemPrompt || '')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [importing, setImporting] = useState(false)

  // 高考日期输入框本地状态
  const [gaokaoDateInput, setGaokaoDateInput] = useState(gaokaoDate)

  // 同步 store 变化到本地输入
  useEffect(() => {
    setApiKeyInput(ai.apiKey)
    setEndpointInput(ai.endpoint)
    setModelInput(ai.model)
    setSystemPromptInput(systemPrompt || '')
  }, [ai.apiKey, ai.endpoint, ai.model, systemPrompt])

  const handleSaveAI = () => {
    setAIConfig({
      apiKey: apiKeyInput.trim(),
      endpoint: endpointInput.trim(),
      model: modelInput.trim()
    })
    if (systemPromptInput.trim()) {
      setSystemPrompt(systemPromptInput.trim())
    }
    showToast('AI 配置已保存')
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    const result = await testConnection({
      apiKey: apiKeyInput.trim(),
      endpoint: endpointInput.trim(),
      model: modelInput.trim()
    })
    setTestResult(result)
    setTesting(false)
  }

  const handleExport = async () => {
    try {
      const method = await exportBackup()
      if (method === 'text') {
        showToast('请手动复制备份文本')
      } else {
        showToast('备份已导出')
      }
    } catch (e: any) {
      showToast(e.message || '导出失败')
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImporting(true)
    try {
      await importBackup(file)
    } catch (err: any) {
      showToast(err?.message || '导入失败')
      setImporting(false)
    }
  }

  const handleReset = () => {
    if (confirm('确定要重置所有数据吗？此操作不可恢复。')) {
      reset()
      showToast('数据已重置')
    }
  }

  return (
    <div className="view active safe-top safe-bottom" style={{ padding: '0 16px 100px', overflowY: 'auto' }}>
      {/* 头部 */}
      <header style={{ padding: '24px 0 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => onNavigate?.('profile')}
          style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--fg)' }}
        >
          ←
        </button>
        <div>
          <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 1, fontWeight: 600 }}>
            SETTINGS
          </div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>设置</div>
        </div>
      </header>

      {/* ═══ AI 监管者配置 ═══ */}
      <SectionTitle icon="🤖" title="AI 监管者" />
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>
          配置你的 AI 监督者。支持任意 OpenAI 兼容 API（DeepSeek、通义千问、智谱等）。
          API Key 仅存储在本地，不会上传到任何服务器。
        </div>

        <InputRow
          label="API Key"
          value={apiKeyInput}
          onChange={setApiKeyInput}
          placeholder="sk-..."
          type="password"
          mono
        />
        <InputRow
          label="Endpoint"
          value={endpointInput}
          onChange={setEndpointInput}
          placeholder="https://api.deepseek.com"
          mono
        />
        <InputRow
          label="模型名称"
          value={modelInput}
          onChange={setModelInput}
          placeholder="deepseek-chat"
          mono
        />

        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6, fontWeight: 600 }}>
            自定义 System Prompt（可选）
          </div>
          <textarea
            value={systemPromptInput}
            onChange={e => setSystemPromptInput(e.target.value)}
            placeholder="留空则使用默认监督者人格..."
            style={{
              width: '100%',
              padding: '10px 12px',
              background: 'var(--bg)',
              color: 'var(--fg)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 13,
              fontFamily: 'inherit',
              outline: 'none',
              minHeight: 80,
              resize: 'vertical'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button
            onClick={handleSaveAI}
            className="btn-primary"
            style={{ flex: 1, padding: '12px 0', fontSize: 14 }}
          >
            保存配置
          </button>
          <button
            onClick={handleTest}
            disabled={testing}
            style={{
              flex: 1,
              padding: '12px 0',
              borderRadius: 100,
              border: '1px solid var(--border)',
              background: 'var(--card-bg)',
              color: 'var(--fg)',
              fontSize: 14,
              fontWeight: 600,
              cursor: testing ? 'not-allowed' : 'pointer',
              opacity: testing ? 0.6 : 1
            }}
          >
            {testing ? '测试中...' : '测试连接'}
          </button>
        </div>

        {testResult && (
          <div style={{
            marginTop: 12,
            padding: '10px 14px',
            borderRadius: 10,
            fontSize: 13,
            background: testResult.ok ? 'rgba(22,163,74,0.08)' : 'rgba(229,77,46,0.08)',
            color: testResult.ok ? 'var(--success)' : 'var(--danger)'
          }}>
            {testResult.ok ? '✓ ' : '✗ '}{testResult.msg}
          </div>
        )}
      </div>

      {/* ═══ 番茄钟 + 学习目标 ═══ */}
      <SectionTitle icon="⏱️" title="专注设置" />
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>
            每日学习目标（分钟）
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[60, 120, 180, 240, 360].map(m => (
              <button
                key={m}
                onClick={() => setDailyGoal(m)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 100,
                  border: '1px solid var(--border)',
                  background: dailyGoalMin === m ? 'var(--fg)' : 'var(--card-bg)',
                  color: dailyGoalMin === m ? 'var(--bg)' : 'var(--fg)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {m}m
              </button>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>
            深渊默认时长（分钟）
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[5, 15, 25, 50].map(m => (
              <button
                key={m}
                onClick={() => setDungeonDuration(m)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 100,
                  border: '1px solid var(--border)',
                  background: dungeonDurationMin === m ? 'var(--fg)' : 'var(--card-bg)',
                  color: dungeonDurationMin === m ? 'var(--bg)' : 'var(--fg)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {m}m
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ 高考目标配置 ═══ */}
      <SectionTitle icon="🎓" title="高考档案" />
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>
          设定高考日期和目标分数。学习、完成任务会让估分上升，娱乐会让估分下降。
        </div>

        <InputRow
          label="高考日期"
          value={gaokaoDateInput}
          onChange={setGaokaoDateInput}
          onBlur={() => {
            if (gaokaoDateInput && gaokaoDateInput !== gaokaoDate) {
              setGaokaoDate(gaokaoDateInput)
              showToast('高考日期已更新')
            }
          }}
          mono
        />

        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>
            目标分数
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[600, 650, 680, 700, 750].map(s => (
              <button
                key={s}
                onClick={() => setGaokaoTargetScore(s)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 100,
                  border: '1px solid var(--border)',
                  background: gaokaoTargetScore === s ? 'var(--fg)' : 'var(--card-bg)',
                  color: gaokaoTargetScore === s ? 'var(--bg)' : 'var(--fg)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div style={{
          marginTop: 16,
          padding: '10px 14px',
          borderRadius: 10,
          background: 'var(--bg-alt)',
          fontSize: 12,
          color: 'var(--muted)',
          lineHeight: 1.6
        }}>
          <span style={{ fontWeight: 600, color: 'var(--fg)' }}>基础估分 {gaokaoBaseScore}</span>
          <br />
          基础估分为起步分数，学习每小时 +5，娱乐每小时 -3，完成任务 +3。
        </div>
      </div>

      {/* ═══ 玩家信息 ═══ */}
      <SectionTitle icon="👤" title="账户" />
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: 'var(--fg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--bg)', fontSize: 16, fontWeight: 700
          }}>
            {playerTag.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{playerTag}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>本地账户 · 数据存于设备</div>
          </div>
        </div>
      </div>

      {/* ═══ 显示设置 ═══ */}
      <SectionTitle icon="🌙" title="显示" />
      <div className="card" style={{ padding: 16, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>深色模式</div>
        <div
          className={`switch ${isDark ? 'on' : ''}`}
          onClick={toggleDark}
          style={{ cursor: 'pointer' }}
        />
      </div>

      {/* ═══ 数据备份 ═══ */}
      <SectionTitle icon="💾" title="数据备份" />
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>
          导出全部数据（HP、积分、任务、成就、AI 配置、高考档案等）到文件，或从备份文件恢复。
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handleExport}
            className="btn-primary"
            style={{ flex: 1, padding: '12px 0', fontSize: 14 }}
          >
            导出备份
          </button>
          <label style={{ flex: 1, cursor: 'pointer' }}>
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              disabled={importing}
              style={{ display: 'none' }}
            />
            <div
              style={{
                padding: '12px 0',
                borderRadius: 100,
                border: '1px solid var(--border)',
                background: 'var(--card-bg)',
                color: 'var(--fg)',
                fontSize: 14,
                fontWeight: 600,
                textAlign: 'center',
                opacity: importing ? 0.6 : 1
              }}
            >
              {importing ? '导入中...' : '导入备份'}
            </div>
          </label>
        </div>
      </div>

      {/* ═══ 危险操作 ═══ */}
      <SectionTitle icon="⚠️" title="危险区域" />
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <button
          onClick={handleReset}
          style={{
            width: '100%',
            padding: '12px 0',
            borderRadius: 100,
            border: '1px solid var(--danger)',
            background: 'transparent',
            color: 'var(--danger)',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          重置所有数据
        </button>
      </div>

      {/* ═══ 关于 ═══ */}
      <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--muted)', fontSize: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--fg)' }}>Cyber Survival</div>
        <div>v2.5.0 · React + Capacitor</div>
        <div style={{ marginTop: 8, display: 'inline-block', padding: '4px 10px', borderRadius: 100, background: 'var(--bg-alt)', fontSize: 11 }}>
          LOCAL · OFFLINE
        </div>
      </div>

      <div style={{ height: 24 }} />
    </div>
  )
}

// ── 子组件 ──

function SectionTitle({ icon, title }: { icon: string; title: string }) {
  return (
    <div style={{
      fontSize: 11,
      color: 'var(--muted)',
      letterSpacing: 1,
      fontWeight: 600,
      marginBottom: 10,
      marginTop: 8,
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }}>
      <span>{icon}</span>
      {title.toUpperCase()}
    </div>
  )
}

function InputRow({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  mono = false,
  onBlur
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  mono?: boolean
  onBlur?: () => void
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '10px 12px',
          background: 'var(--bg)',
          color: 'var(--fg)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          fontSize: 13,
          fontFamily: mono ? 'DM Mono, monospace' : 'inherit',
          outline: 'none',
          boxSizing: 'border-box'
        }}
      />
    </div>
  )
}
