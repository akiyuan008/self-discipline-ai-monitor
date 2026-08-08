import { useState, useEffect } from 'react'
import { useStore, PRESET_AI_CONFIG } from '@/stores/useStore'
import { showToast } from '@/components/Toast'
import { hasUsageAccess, openUsageAccessSettings } from '@/lib/usageStats'
import { App } from '@capacitor/app'
import type { AIConfig } from '@/stores/useStore'

export default function Onboarding() {
  const init = useStore(s => s.init)
  const [step, setStep] = useState(0)
  const [tag, setTag] = useState('PLAYER_01')
  const [goal, setGoal] = useState(120)
  const [ai, setAI] = useState<AIConfig>({ ...PRESET_AI_CONFIG })
  const [usageGranted, setUsageGranted] = useState(false)
  const [checkingPermission, setCheckingPermission] = useState(false)

  const checkPermission = async () => {
    setCheckingPermission(true)
    try {
      const granted = await hasUsageAccess()
      setUsageGranted(granted)
    } catch {
      setUsageGranted(false)
    } finally {
      setCheckingPermission(false)
    }
  }

  useEffect(() => {
    checkPermission()
    const sub = App.addListener('resume', () => {
      checkPermission()
    })
    return () => {
      sub.then(s => s.remove())
    }
  }, [])

  function finish() {
    init(tag.trim() || 'PLAYER_01', goal, ai)
    showToast(`欢迎，${tag || 'PLAYER_01'}`)
  }

  const handleGrantPermission = async () => {
    try {
      showToast('正在为你跳转到系统设置页…')
      await openUsageAccessSettings()
    } catch (e: any) {
      showToast('无法自动打开设置页，请在手机设置-隐私-使用情况访问中手动开启')
    }
  }

  return (
    <div className="min-h-full flex flex-col" style={{ padding: 'max(48px, env(safe-area-inset-top)) 24px max(48px, env(safe-area-inset-bottom))' }}>
      {/* 步骤指示 */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 32 }}>
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 2,
              background: i <= step ? 'var(--fg)' : 'var(--border)'
            }}
          />
        ))}
      </div>

      {step === 0 && (
        <div className="flex-1 flex flex-col animate-in">
          <div style={{ fontSize: 12, fontFamily: 'DM Mono, monospace', color: 'var(--muted)', marginBottom: 8 }}>
            INITIALIZATION // 01
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: -0.5, marginBottom: 12 }}>
            欢迎接入
            <br />
            Cyber Survival
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 40 }}>
            在这个赛博自律世界里，积分是你的财富，深渊挑战是学习时段，MOSS 会守护你的进度曲线。
          </p>

          <label style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>玩家代号</label>
          <input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="PLAYER_01"
            style={{
              width: '100%',
              padding: '14px 16px',
              borderRadius: 12,
              background: 'var(--card-bg)',
              border: '1px solid var(--border)',
              color: 'var(--fg)',
              fontSize: 16,
              fontFamily: 'DM Mono, monospace',
              outline: 'none',
              marginBottom: 24
            }}
          />

          <div style={{ flex: 1 }} />

          <button
            onClick={() => setStep(1)}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: 100,
              background: 'var(--fg)',
              color: 'var(--bg)',
              fontSize: 16,
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer'
            }}
          >
            继续
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="flex-1 flex flex-col animate-in">
          <div style={{ fontSize: 12, fontFamily: 'DM Mono, monospace', color: 'var(--muted)', marginBottom: 8 }}>
            INITIALIZATION // 02
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: -0.5, marginBottom: 12 }}>
            每日目标
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 32 }}>
            系统会根据目标时长判断你的学习进度，每日打卡完成任务即可增长连签天数。
          </p>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 48, fontWeight: 300, color: 'var(--fg)' }}>{goal}</span>
            <span style={{ fontSize: 14, color: 'var(--muted)' }}>分钟</span>
          </div>
          <input
            type="range" min={30} max={480} step={30}
            value={goal}
            onChange={(e) => setGoal(+e.target.value)}
            style={{ width: '100%', accentColor: 'var(--fg)' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
            <span>30m</span><span>2h</span><span>4h</span><span>8h</span>
          </div>

          <div style={{ flex: 1 }} />

          <button
            onClick={() => setStep(2)}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: 100,
              background: 'var(--fg)',
              color: 'var(--bg)',
              fontSize: 16,
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer'
            }}
          >
            继续
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="flex-1 flex flex-col animate-in">
          <div style={{ fontSize: 12, fontFamily: 'DM Mono, monospace', color: 'var(--muted)', marginBottom: 8 }}>
            INITIALIZATION // 03
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: -0.5, marginBottom: 12 }}>
            使用情况访问权限
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
            为了能准确统计你的每日学习应用与娱乐应用时长，MOSS 需要获取系统的「使用情况访问权限」。
          </p>

          <div style={{
            padding: 18,
            borderRadius: 12,
            background: 'var(--card-bg)',
            border: `1px solid ${usageGranted ? 'var(--success)' : 'var(--border)'}`,
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                权限状态
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
                {checkingPermission ? '正在检测权限…' : (usageGranted ? '✓ 已成功授予使用情况访问权限' : '未开启权限（可能影响时长统计）')}
              </div>
            </div>
            <div style={{
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              fontFamily: 'DM Mono, monospace',
              background: usageGranted ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
              color: usageGranted ? '#22c55e' : '#ef4444',
              border: `1px solid ${usageGranted ? '#22c55e' : '#ef4444'}`
            }}>
              {usageGranted ? 'ONLINE' : 'OFFLINE'}
            </div>
          </div>

          <button
            onClick={handleGrantPermission}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: 12,
              background: usageGranted ? 'var(--bg-alt)' : '#ff4500',
              color: usageGranted ? 'var(--fg)' : '#ffffff',
              fontSize: 15,
              fontWeight: 700,
              border: usageGranted ? '1px solid var(--border)' : 'none',
              cursor: 'pointer',
              boxShadow: usageGranted ? 'none' : '0 4px 15px rgba(255,69,0,0.3)',
              marginBottom: 16
            }}
          >
            {usageGranted ? '已开启权限 (再次打开设置)' : '▶ 开启使用情况访问权限'}
          </button>

          <div style={{ flex: 1 }} />

          <button
            onClick={() => setStep(3)}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: 100,
              background: 'var(--fg)',
              color: 'var(--bg)',
              fontSize: 16,
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer'
            }}
          >
            继续
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="flex-1 flex flex-col animate-in">
          <div style={{ fontSize: 12, fontFamily: 'DM Mono, monospace', color: 'var(--muted)', marginBottom: 8 }}>
            INITIALIZATION // 04
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: -0.5, marginBottom: 12 }}>
            接入 MOSS
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>
            填入兼容 OpenAI 协议的大模型 API。MOSS 会在你低谷时主动开口、能调任务/积分/成就。
          </p>

          <label style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>API Key</label>
          <input
            value={ai.apiKey}
            onChange={(e) => setAI({ ...ai, apiKey: e.target.value })}
            placeholder="sk-xxx"
            type="password"
            style={{
              width: '100%',
              padding: '14px 16px',
              borderRadius: 12,
              background: 'var(--card-bg)',
              border: '1px solid var(--border)',
              color: 'var(--fg)',
              fontSize: 14,
              fontFamily: 'DM Mono, monospace',
              outline: 'none',
              marginBottom: 16
            }}
          />

          <label style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Base URL</label>
          <input
            value={ai.endpoint}
            onChange={(e) => setAI({ ...ai, endpoint: e.target.value })}
            placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
            style={{
              width: '100%',
              padding: '14px 16px',
              borderRadius: 12,
              background: 'var(--card-bg)',
              border: '1px solid var(--border)',
              color: 'var(--fg)',
              fontSize: 13,
              fontFamily: 'DM Mono, monospace',
              outline: 'none',
              marginBottom: 16
            }}
          />

          <label style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Model</label>
          <input
            value={ai.model}
            onChange={(e) => setAI({ ...ai, model: e.target.value })}
            placeholder="qwen-plus"
            style={{
              width: '100%',
              padding: '14px 16px',
              borderRadius: 12,
              background: 'var(--card-bg)',
              border: '1px solid var(--border)',
              color: 'var(--fg)',
              fontSize: 13,
              fontFamily: 'DM Mono, monospace',
              outline: 'none',
              marginBottom: 16
            }}
          />

          <div style={{
            padding: '10px 12px',
            background: 'rgba(22, 163, 74, 0.08)',
            borderRadius: 8,
            fontSize: 11, color: 'var(--success)',
            lineHeight: 1.8,
            marginBottom: 16
          }}>
            ✓ 已预置阿里云百炼（通义千问）配置，可直接进入。
          </div>

          <div style={{ flex: 1 }} />

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={finish}
              style={{
                flex: 1, padding: '16px',
                borderRadius: 100,
                background: 'transparent',
                color: 'var(--muted)',
                fontSize: 14,
                fontWeight: 600,
                border: '1px solid var(--border)',
                cursor: 'pointer'
              }}
            >
              跳过
            </button>
            <button
              onClick={finish}
              style={{
                flex: 2, padding: '16px',
                borderRadius: 100,
                background: 'var(--fg)',
                color: 'var(--bg)',
                fontSize: 16,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer'
              }}
            >
              进入赛博世界
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
