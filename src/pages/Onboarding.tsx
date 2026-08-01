import { useState } from 'react'
import { useStore } from '@/stores/useStore'
import { showToast } from '@/components/Toast'
import ModelPicker from '@/components/ModelPicker'
import { MODEL_PRESETS } from '@/data/modelPresets'
import type { AIConfig } from '@/stores/useStore'

export default function Onboarding() {
  const init = useStore(s => s.init)
  const [step, setStep] = useState(0)
  const [tag, setTag] = useState('PLAYER_01')
  const [goal, setGoal] = useState(120)
  const [ai, setAI] = useState<AIConfig>({ apiKey: '', endpoint: '', model: 'glm-4-plus' })
  const [showPicker, setShowPicker] = useState(false)

  function finish() {
    init(tag.trim() || 'PLAYER_01', goal, ai)
    showToast(`欢迎，${tag || 'PLAYER_01'}`)
  }

  return (
    <div className="min-h-full flex flex-col" style={{ padding: 'max(48px, env(safe-area-inset-top)) 24px max(48px, env(safe-area-inset-bottom))' }}>
      {/* 步骤指示 */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 32 }}>
        {[0, 1, 2].map(i => (
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
            在这个赛博自律世界里，你的精神力即是 HP，深渊挑战是学习时段，AI 监管者会守护你的进度曲线。
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
              border: 'none'
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
            系统会根据目标时长判断你的 HP 走势，未达 60% 视为「精神力流失」。
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
              border: 'none'
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
            接入 AI 监管者
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 32 }}>
            选择国内主流大模型供应商，填入 API Key。监管者会在你低谷时主动开口、能调任务/积分/成就。
          </p>

          {/* 模型选择按钮 */}
          <label style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>选择供应商和模型</label>
          <button
            onClick={() => setShowPicker(true)}
            style={{
              width: '100%',
              padding: '14px 16px',
              borderRadius: 12,
              background: 'var(--card-bg)',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              {(() => {
                const p = MODEL_PRESETS.find(x => x.endpoint === ai.endpoint)
                if (!p) return (
                  <span style={{ fontSize: 14, color: 'var(--muted)' }}>
                    点击选择 →
                  </span>
                )
                return (
                  <>
                    <div style={{
                      width: 28, height: 28, borderRadius: 6,
                      background: p.accent,
                      color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: 11, flexShrink: 0
                    }}>
                      {p.logoText}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontSize: 14, fontWeight: 600,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                      }}>
                        {p.vendor} · {ai.model || '未选模型'}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
                        {p.endpoint}
                      </div>
                    </div>
                  </>
                )
              })()}
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>

          <label style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>API Key</label>
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
              marginBottom: 24
            }}
          />

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
                border: '1px solid var(--border)'
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
                border: 'none'
              }}
            >
              进入赛博世界
            </button>
          </div>
        </div>
      )}

      {showPicker && (
        <ModelPicker
          currentEndpoint={ai.endpoint}
          currentModel={ai.model}
          onSelect={(ep, m) => setAI({ ...ai, endpoint: ep, model: m })}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  )
}
