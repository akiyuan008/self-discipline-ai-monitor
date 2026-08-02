import { useState } from 'react'
import { useStore } from '@/stores/useStore'

export default function Onboarding() {
  const init = useStore(s => s.init)
  const [step, setStep] = useState(0)
  const [tag, setTag] = useState('PLAYER_01')
  const [goal, setGoal] = useState(120)

  const handleFinish = () => {
    init(tag, goal)
  }

  return (
    <div className="view active" style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '0 32px', minHeight: '100%',
      background: 'var(--bg)'
    }}>
      {step === 0 && (
        <div style={{ width: '100%', maxWidth: 360, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 2, marginBottom: 24 }}>
            INITIALIZATION // 01
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12, lineHeight: 1.3 }}>
            欢迎接入<br />Cyber Survival
          </h1>
          <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 40 }}>
            在这个赛博自律世界里，你的精神力即是 HP，深渊挑战是学习时段，系统会守护你的进度曲线。
          </p>

          <div style={{ textAlign: 'left', marginBottom: 32 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--muted)' }}>
              玩家代号
            </div>
            <input
              value={tag}
              onChange={e => setTag(e.target.value)}
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
          </div>

          <button
            onClick={() => setStep(1)}
            className="btn-primary"
            style={{ width: '100%', padding: 16, fontSize: 16 }}
          >
            下一步
          </button>
        </div>
      )}

      {step === 1 && (
        <div style={{ width: '100%', maxWidth: 360, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 2, marginBottom: 24 }}>
            INITIALIZATION // 02
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>每日目标</h1>
          <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 40 }}>
            系统会根据目标时长判断你的 HP 走势，未达 60% 视为「精神力流失」。
          </p>

          <div style={{ fontSize: 48, fontWeight: 200, marginBottom: 24 }}>
            {goal}分钟
          </div>
          <input
            type="range"
            min={30}
            max={480}
            step={30}
            value={goal}
            onChange={e => setGoal(+e.target.value)}
            style={{ width: '100%', accentColor: 'var(--fg)', marginBottom: 16 }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', marginBottom: 40 }}>
            <span>30m</span>
            <span>2h</span>
            <span>4h</span>
            <span>8h</span>
          </div>

          <button
            onClick={() => setStep(2)}
            className="btn-primary"
            style={{ width: '100%', padding: 16, fontSize: 16 }}
          >
            下一步
          </button>
        </div>
      )}

      {step === 2 && (
        <div style={{ width: '100%', maxWidth: 360, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 2, marginBottom: 24 }}>
            INITIALIZATION // 03
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>
            准备进入赛博世界
          </h1>
          <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 40 }}>
            现在就开始你的自律之旅，系统会为你记录学习与娱乐状态。
          </p>

          <div style={{ fontSize: 64, marginBottom: 40 }}>🚀</div>

          <button
            onClick={handleFinish}
            className="btn-primary"
            style={{ width: '100%', padding: 16, fontSize: 16 }}
          >
            开始自律
          </button>
        </div>
      )}
    </div>
  )
}
