import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PERSONAS, type PersonaId } from '@/data/personas'
import { useUserStore } from '@/stores/userStore'

export default function Onboarding() {
  const nav = useNavigate()
  const init = useUserStore(s => s.init)
  const [step, setStep] = useState<0 | 1 | 2>(0)
  const [nickname, setNickname] = useState('')
  const [personaId, setPersonaId] = useState<PersonaId | null>(null)
  const [goal, setGoal] = useState(120)

  const persona = PERSONAS.find(p => p.id === personaId)

  function finish() {
    init(nickname.trim() || '同学', personaId || 'mentor', goal)
    nav('/', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 to-bg-page max-w-[480px] mx-auto flex flex-col">
      <div className="safe-top" />
      <div className="px-6 py-8 flex-1 flex flex-col">
        {/* 进度 */}
        <div className="flex gap-2 mb-8">
          {[0, 1, 2].map(i => (
            <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-brand' : 'bg-stroke'}`} />
          ))}
        </div>

        {step === 0 && (
          <div className="flex-1 flex flex-col animate-in">
            <div className="text-6xl mb-6 mt-12 text-center">🌱</div>
            <h1 className="text-2xl font-bold text-center mb-2">自律养成</h1>
            <p className="text-ink-3 text-center mb-12">AI 监工陪你不摆烂</p>
            <label className="text-sm text-ink-2 mb-2">先告诉我，怎么称呼你？</label>
            <input
              className="w-full bg-white rounded-2xl px-4 py-3.5 text-base outline-none border border-stroke focus:border-brand"
              placeholder="昵称 / 姓名"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              autoFocus
            />
            <div className="flex-1" />
            <button
              className="btn-primary w-full py-3.5 text-base mt-6"
              onClick={() => setStep(1)}
            >下一步</button>
          </div>
        )}

        {step === 1 && (
          <div className="flex-1 flex flex-col animate-in">
            <h1 className="text-2xl font-bold mb-1">选你的监工</h1>
            <p className="text-ink-3 text-sm mb-6">不同人格不同语气，想换可以随时改</p>
            <div className="flex-1 overflow-y-auto space-y-3 scrollbar-hide">
              {PERSONAS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setPersonaId(p.id)}
                  className={`w-full text-left bg-white rounded-2xl p-4 border-2 transition ${
                    personaId === p.id ? 'border-brand' : 'border-transparent'
                  }`}
                  style={{ boxShadow: personaId === p.id ? `0 8px 24px ${p.color}22` : '0 4px 16px rgba(0,0,0,0.04)' }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-2xl shrink-0"
                      style={{ background: p.color + '18' }}
                    >{p.emoji}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold" style={{ color: p.color }}>{p.name}</h3>
                        <span className="text-xs text-ink-3 truncate">{p.tagline}</span>
                      </div>
                      <p className="text-sm text-ink-2 mt-1 leading-relaxed">{p.desc}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {p.strengths.map(s => (
                          <span key={s} className="chip" style={{ color: p.color, background: p.color + '14' }}>{s}</span>
                        ))}
                      </div>
                    </div>
                    {personaId === p.id && (
                      <div className="w-5 h-5 rounded-full bg-brand text-white flex items-center justify-center text-xs shrink-0">✓</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button className="btn-ghost flex-1 py-3" onClick={() => setStep(0)}>上一步</button>
              <button
                className="btn-primary flex-[2] py-3 disabled:opacity-50"
                disabled={!personaId}
                onClick={() => setStep(2)}
              >选定：{persona?.name}</button>
            </div>
          </div>
        )}

        {step === 2 && persona && (
          <div className="flex-1 flex flex-col animate-in">
            <h1 className="text-2xl font-bold mb-1">最后一步</h1>
            <p className="text-ink-3 text-sm mb-6">设置每日学习目标，监工会按此给分</p>

            <div className="card p-5 mb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl" style={{ background: persona.color + '18' }}>{persona.emoji}</div>
                <div>
                  <h3 className="font-semibold" style={{ color: persona.color }}>{persona.name}</h3>
                  <p className="text-xs text-ink-3">{persona.tagline}</p>
                </div>
              </div>
              <div className="bg-bg-soft rounded-xl p-3 text-sm text-ink-2 leading-relaxed">
                "{persona.greeting}"
              </div>
            </div>

            <div className="card p-5 mb-4">
              <div className="flex justify-between items-baseline mb-3">
                <span className="text-sm text-ink-2">每日学习目标</span>
                <span className="text-2xl font-bold text-brand">{goal}<span className="text-sm font-normal text-ink-3 ml-1">分钟</span></span>
              </div>
              <input
                type="range" min={30} max={360} step={30}
                value={goal}
                onChange={e => setGoal(+e.target.value)}
                className="w-full accent-brand"
              />
              <div className="flex justify-between text-[10px] text-ink-3 mt-1">
                <span>30</span><span>2h</span><span>4h</span><span>6h</span>
              </div>
              <p className="text-xs text-ink-3 mt-3 leading-relaxed">
                · 达成目标得 50 分基础分 + 专注度加成<br />
                · 超过娱乐时长阈值会触发惩罚<br />
                · 深夜连续学习监工会主动劝休
              </p>
            </div>

            <div className="flex-1" />
            <button className="btn-primary w-full py-3.5 text-base" onClick={finish}>
              开始自律 ✨
            </button>
          </div>
        )}
      </div>
      <div className="safe-bottom" />
    </div>
  )
}
