/**
 * src/components/growth/GrProfile.tsx
 * Growth Mode Profile — 个人中心。温暖、中文为主的用户档案页。
 * 复用现有 store 数据（playerTag, streak, points, gaokao, gaoKaoStore）。
 */
import { useState } from 'react'
import { useStore, daysUntilGaokao } from '@/stores/useStore'
import { useGaoKaoStore } from '@/stores/gaoKaoStore'
import Icon from '@/components/Icons'
import type { PageId } from '@/stores/useStore'

interface ProfileProps {
  onNavigate?: (page: any) => void
  onNavigateStats?: () => void
}

export default function GrProfile({ onNavigate, onNavigateStats }: ProfileProps) {
  const playerTag = useStore(s => s.playerTag)
  const streak = useStore(s => s.streak)
  const points = useStore(s => s.points)
  const level = useStore(s => s.level)
  const totalExp = useStore(s => s.totalExp)
  const gaokaoDate = useStore(s => s.gaokaoDate)
  const setGaokaoDate = useStore(s => s.setGaokaoDate)

  const profile = useGaoKaoStore(s => s.profile)
  const updateSubject = useGaoKaoStore(s => s.updateSubject)
  const updateProfile = useGaoKaoStore(s => s.updateProfile)

  const [editingSubject, setEditingSubject] = useState<string | null>(null)
  const [editingProfile, setEditingProfile] = useState(false)
  const [pNickname, setPNickname] = useState(profile.nickname)
  const [pUniversity, setPUniversity] = useState(profile.targetUniversity)
  const [pCurrentScore, setPCurrentScore] = useState(String(profile.currentTotalScore))
  const [pTargetScore, setPTargetScore] = useState(String(profile.targetTotalScore))
  const [pGaokaoDate, setPGaokaoDate] = useState(gaokaoDate)

  function openProfileEdit() {
    setPNickname(profile.nickname); setPUniversity(profile.targetUniversity)
    setPCurrentScore(String(profile.currentTotalScore)); setPTargetScore(String(profile.targetTotalScore))
    setPGaokaoDate(gaokaoDate); setEditingProfile(true)
  }
  function saveProfile() {
    updateProfile({
      nickname: pNickname.trim() || '考生',
      targetUniversity: pUniversity.trim() || '目标大学',
      currentTotalScore: Math.max(0, Math.min(750, Number(pCurrentScore) || 0)),
      targetTotalScore: Math.max(0, Math.min(750, Number(pTargetScore) || 0)),
    })
    if (pGaokaoDate) setGaokaoDate(pGaokaoDate)
    setEditingProfile(false)
  }

  const days = daysUntilGaokao(gaokaoDate)
  const scoreGap = profile.targetTotalScore - profile.currentTotalScore
  const expInLevel = totalExp % 1000
  const expPercent = Math.min(100, (expInLevel / 1000) * 100)
  const expToNext = 1000 - expInLevel

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', background: 'var(--growth-surface-alt)',
    color: 'var(--growth-text)', border: '1px solid var(--growth-border)',
    borderRadius: 'var(--growth-radius-sm)', fontSize: 14, outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div className="gr-page">
      {/* 标题 */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 14, color: 'var(--growth-text-secondary)', marginBottom: 2 }}>个人中心</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--growth-text)' }}>{profile.nickname}</div>
      </div>

      {/* 学习档案入口 */}
      <div className="gr-card" style={{ marginBottom: 8, cursor: 'pointer' }} onClick={() => onNavigate?.('classHistory' as any)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 'var(--growth-radius-sm)', background: 'var(--growth-surface-alt)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--growth-text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--growth-text)' }}>学习档案</div>
            <div style={{ fontSize: 11, color: 'var(--growth-text-secondary)' }}>课程记录、打卡照片、深渊远征</div>
          </div>
          <div style={{ fontSize: 18, color: 'var(--growth-text-secondary)' }}>›</div>
        </div>
      </div>

      {/* 成长档案 */}
      <div className="gr-card" style={{ marginBottom: 12 }}>
        {/* 头部 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--growth-text-secondary)', marginBottom: 4 }}>{playerTag}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--growth-text)' }}>{profile.nickname}</div>
            <div style={{ fontSize: 12, color: 'var(--growth-text-secondary)', marginTop: 2 }}>目标：{profile.targetUniversity}</div>
          </div>
          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <button onClick={() => editingProfile ? saveProfile() : openProfileEdit()} className="gr-btn gr-btn-outline" style={{ padding: '4px 12px', fontSize: 12 }}>
              {editingProfile ? '保存' : '编辑'}
            </button>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, color: days <= 100 ? 'var(--danger)' : 'var(--growth-text)' }}>{days}</div>
              <div style={{ fontSize: 10, color: 'var(--growth-text-secondary)' }}>天后高考</div>
            </div>
          </div>
        </div>

        {/* 编辑表单 */}
        {editingProfile && (
          <div className="gr-card-alt" style={{ marginBottom: 12 }}>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: 'var(--growth-text-secondary)', marginBottom: 5 }}>昵称</div>
              <input value={pNickname} onChange={e => setPNickname(e.target.value)} placeholder="考生" style={inputStyle} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: 'var(--growth-text-secondary)', marginBottom: 5 }}>目标大学</div>
              <input value={pUniversity} onChange={e => setPUniversity(e.target.value)} placeholder="目标大学" style={inputStyle} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: 'var(--growth-text-secondary)', marginBottom: 5 }}>当前分数</div>
                <input type="number" value={pCurrentScore} onChange={e => setPCurrentScore(e.target.value)} placeholder="460" style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: 'var(--growth-text-secondary)', marginBottom: 5 }}>目标分数</div>
                <input type="number" value={pTargetScore} onChange={e => setPTargetScore(e.target.value)} placeholder="680" style={inputStyle} />
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: 'var(--growth-text-secondary)', marginBottom: 5 }}>高考日期</div>
              <input type="date" value={pGaokaoDate} onChange={e => setPGaokaoDate(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="gr-btn gr-btn-primary" style={{ flex: 1 }} onClick={saveProfile}>保存</button>
              <button className="gr-btn gr-btn-outline" style={{ flex: 1 }} onClick={() => setEditingProfile(false)}>取消</button>
            </div>
          </div>
        )}

        {/* 分数对比 */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, padding: '10px 0', borderTop: '1px solid var(--growth-border)' }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--growth-text-secondary)' }}>当前</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--growth-text)' }}>{profile.currentTotalScore}</div>
          </div>
          <div style={{ fontSize: 16, color: 'var(--growth-text-secondary)', paddingBottom: 2 }}>→</div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--growth-text-secondary)' }}>目标</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--success)' }}>{profile.targetTotalScore}</div>
          </div>
          <div style={{ flex: 1, textAlign: 'right' }}>
            <div style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 100, background: scoreGap > 0 ? 'rgba(192,80,74,0.1)' : 'rgba(78,184,160,0.1)', color: scoreGap > 0 ? 'var(--danger)' : 'var(--success)', fontSize: 12, fontWeight: 600 }}>
              {scoreGap > 0 ? `差 ${scoreGap} 分` : '已达标'}
            </div>
          </div>
        </div>

        {/* 等级进度 */}
        <div style={{ padding: '10px 0', borderTop: '1px solid var(--growth-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--growth-text-secondary)' }}>等级 Lv.{level}</span>
            <span style={{ fontSize: 12, color: 'var(--growth-text-secondary)' }}>距下一级 {expToNext} 经验</span>
          </div>
          <div className="gr-progress">
            <div className="gr-progress-fill" style={{ width: `${expPercent}%`, background: 'var(--growth-warm)' }} />
          </div>
        </div>

        {/* 快速统计 */}
        <div style={{ display: 'flex', gap: 0, borderTop: '1px solid var(--growth-border)', paddingTop: 8, marginTop: 4 }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: 'var(--growth-text-secondary)', marginBottom: 2 }}>连签</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--growth-text)' }}>{streak}天</div>
          </div>
          <div style={{ width: 1, background: 'var(--growth-border)' }} />
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: 'var(--growth-text-secondary)', marginBottom: 2 }}>积分</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--growth-warm)' }}>{points}</div>
          </div>
          <div style={{ width: 1, background: 'var(--growth-border)' }} />
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: 'var(--growth-text-secondary)', marginBottom: 2 }}>总经验</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--growth-text)' }}>{totalExp}</div>
          </div>
        </div>
      </div>

      {/* 各科提分雷达 */}
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--growth-text-secondary)', marginBottom: 8 }}>各科提分</div>
      {profile.subjects.map(sub => {
        const pct = Math.min(100, (sub.currentScore / sub.targetScore) * 100)
        const gap = sub.targetScore - sub.currentScore
        const isWeak = gap > sub.fullScore * 0.2 || sub.currentScore < sub.fullScore * 0.5
        return (
          <div key={sub.name} className="gr-card" style={{ padding: 12, marginBottom: 6, borderLeft: `3px solid ${isWeak ? 'var(--danger)' : 'var(--success)'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--growth-text)' }}>{sub.name}</span>
                {isWeak && <span style={{ padding: '2px 8px', borderRadius: 100, background: 'rgba(192,80,74,0.1)', color: 'var(--danger)', fontSize: 9, fontWeight: 600 }}>薄弱</span>}
              </div>
              {editingSubject === sub.name ? (
                <input type="number" defaultValue={sub.currentScore} max={sub.fullScore} min={0}
                  onBlur={(e) => {
                    const val = Math.max(0, Math.min(sub.fullScore, Number(e.target.value) || 0))
                    updateSubject(sub.name, { currentScore: val })
                    const newSubjects = profile.subjects.map(s => s.name === sub.name ? { ...s, currentScore: val } : s)
                    updateProfile({ currentTotalScore: newSubjects.reduce((sum, s) => sum + s.currentScore, 0) })
                    setEditingSubject(null)
                  }}
                  style={{ width: 60, padding: '4px 8px', background: 'var(--growth-surface)', border: '1px solid var(--growth-border)', borderRadius: 6, color: 'var(--growth-text)', fontSize: 13, outline: 'none', textAlign: 'right' }}
                  autoFocus />
              ) : (
                <div style={{ fontSize: 12, color: isWeak ? 'var(--danger)' : 'var(--growth-text)', cursor: 'pointer' }} onClick={() => setEditingSubject(sub.name)}>
                  {sub.currentScore} / {sub.fullScore}
                </div>
              )}
            </div>
            <div className="gr-progress">
              <div className="gr-progress-fill" style={{ width: `${pct}%`, background: isWeak ? 'var(--danger)' : 'var(--success)' }} />
            </div>
          </div>
        )
      })}

      {/* 列表入口 */}
      <button className="gr-card" style={{ width: '100%', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', textAlign: 'left' }} onClick={() => onNavigate?.('achievements')}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--growth-text)' }}>成就勋章</div>
          <div style={{ fontSize: 11, color: 'var(--growth-text-secondary)', marginTop: 2 }}>稀有度分级 · 解锁进度</div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--growth-text-secondary)" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
      </button>
      <button className="gr-card" style={{ width: '100%', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', textAlign: 'left' }} onClick={() => onNavigate?.('settings')}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--growth-text)' }}>系统设置</div>
          <div style={{ fontSize: 11, color: 'var(--growth-text-secondary)', marginTop: 2 }}>深色模式、配置、关于</div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--growth-text-secondary)" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
      </button>
    </div>
  )
}
