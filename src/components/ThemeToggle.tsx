import { useEffect } from 'react'
import { useStore, WANDERING_THEME_UNLOCK_EXP } from '@/stores/useStore'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useStore(s => s.theme)
  const darkModeMode = useStore(s => s.darkModeMode || 'system')

  useEffect(() => {
    const applyTheme = () => {
      if (theme === 'wandering') {
        document.documentElement.setAttribute('data-theme', 'wandering')
        document.documentElement.classList.add('dark')
        return
      }

      let isDark = false
      if (darkModeMode === 'system') {
        isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      } else if (darkModeMode === 'dark') {
        isDark = true
      } else {
        isDark = false
      }

      if (isDark) {
        document.documentElement.setAttribute('data-theme', 'dark')
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.setAttribute('data-theme', 'light')
        document.documentElement.classList.remove('dark')
      }
    }

    applyTheme()

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = () => {
      if (theme !== 'wandering' && darkModeMode === 'system') {
        applyTheme()
      }
    }

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', listener)
      return () => mediaQuery.removeEventListener('change', listener)
    }
  }, [theme, darkModeMode])

  return <>{children}</>
}

export function ThemeToggle() {
  const theme = useStore(s => s.theme)
  const darkModeMode = useStore(s => s.darkModeMode || 'system')
  const setDarkModeMode = useStore(s => s.setDarkModeMode)
  const exp = useStore(s => s.exp)
  const totalExp = useStore(s => s.totalExp)
  const level = useStore(s => s.level)
  const unlockedThemes = useStore(s => s.unlockedThemes)
  const setTheme = useStore(s => s.setTheme)
  const unlockTheme = useStore(s => s.unlockTheme)

  const isWandering = theme === 'wandering'
  const effectiveExp = Math.max(exp, totalExp)
  const expQualified = effectiveExp >= WANDERING_THEME_UNLOCK_EXP || level >= 2
  const hasWandering = unlockedThemes.includes('wandering') || expQualified

  function handleSelectWandering() {
    if (hasWandering) {
      if (!unlockedThemes.includes('wandering')) {
        unlockTheme('wandering')
      }
      setTheme('wandering')
      showToast('🌍 行星发动机·流浪地球主题已启用！')
    } else {
      showToast(`经验值不足！需达到 1000 XP (等级 Lv.2) 解锁，当前: ${effectiveExp} XP`)
    }
  }

  const expPct = Math.min(100, Math.round((effectiveExp / WANDERING_THEME_UNLOCK_EXP) * 100))

  return (
    <div style={{
      padding: '16px', borderRadius: 12,
      background: 'var(--card-bg)', border: '1px solid var(--border)',
      marginBottom: 12, position: 'relative'
    }}>
      <div className="corner-deco tl" style={{ width: 10, height: 10, borderWidth: 1 }} />
      <div className="corner-deco tr" style={{ width: 10, height: 10, borderWidth: 1 }} />
      <div className="corner-deco bl" style={{ width: 10, height: 10, borderWidth: 1 }} />
      <div className="corner-deco br" style={{ width: 10, height: 10, borderWidth: 1 }} />

      {/* 外观外观暗色模式选择 */}
      <div style={{ marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--fg)' }}>
          外观颜色模式
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {(['system', 'light', 'dark'] as const).map(m => {
            const labelMap = { system: '📱 跟随系统', light: '☀️ 浅色模式', dark: '🌙 深色模式' }
            const active = darkModeMode === m
            return (
              <button
                key={m}
                onClick={() => {
                  setDarkModeMode(m)
                  showToast(`已设置为：${labelMap[m]}`)
                }}
                style={{
                  padding: '8px 4px',
                  borderRadius: 6,
                  border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
                  background: active ? 'var(--accent-dim)' : 'var(--bg-alt)',
                  color: active ? 'var(--accent)' : 'var(--fg)',
                  fontSize: 12,
                  fontWeight: active ? 700 : 400,
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                {labelMap[m]}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Teko, sans-serif', letterSpacing: 1, textTransform: 'uppercase' }}>
            {isWandering ? '🌍 UEG INTERFACE // 主题皮肤' : '主题皮肤选择'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, fontFamily: isWandering ? 'Share Tech Mono, monospace' : 'inherit' }}>
            {isWandering ? 'UEG SYSTEM STATUS: ONLINE' : '通过积累经验值解锁专属科技皮肤'}
          </div>
        </div>
        <div style={{
          padding: '4px 10px', borderRadius: 4,
          background: isWandering ? 'rgba(255,69,0,0.15)' : 'var(--bg-alt)',
          color: isWandering ? '#ff4500' : 'var(--muted)',
          border: isWandering ? '1px solid #ff4500' : '1px solid var(--border)',
          fontSize: 10, fontWeight: 700, fontFamily: 'Share Tech Mono, monospace'
        }}>
          {isWandering ? 'WANDERING' : 'DEFAULT'}
        </div>
      </div>

      {/* 默认主题 */}
      <button onClick={() => { setTheme('default'); showToast('已切换至默认极简主题') }} style={{
        width: '100%', padding: '12px 14px', marginBottom: 10,
        background: theme === 'default' ? 'var(--accent-dim)' : 'var(--bg-alt)',
        border: theme === 'default' ? '1px solid var(--accent)' : '1px solid var(--border)',
        color: theme === 'default' ? 'var(--accent)' : 'var(--fg)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
        clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
        textAlign: 'left'
      }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'linear-gradient(135deg, #667eea, #764ba2)', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>基础控制台 (Default)</div>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>系统预设极简双色主题</div>
        </div>
        {theme === 'default' && <span style={{ color: 'var(--accent)', fontSize: 16, fontWeight: 'bold' }}>✓</span>}
      </button>

      {/* 流浪地球 · 行星发动机主题 */}
      <div style={{
        background: theme === 'wandering' ? 'rgba(0,229,255,0.08)' : 'var(--bg-alt)',
        border: theme === 'wandering' ? '1px solid #00e5ff' : '1px solid var(--border)',
        borderRadius: 8, padding: '12px 14px', position: 'relative', overflow: 'hidden'
      }}>
        <button
          onClick={handleSelectWandering}
          style={{
            width: '100%', background: 'transparent', border: 'none', padding: 0,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left'
          }}
        >
          <div style={{
            width: 38, height: 38, borderRadius: 8,
            background: 'radial-gradient(circle at 30% 30%, #ff4500, #0a0e1a)',
            border: '1px solid #ff4500',
            boxShadow: '0 0 12px rgba(255, 69, 0, 0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, flexShrink: 0
          }}>
            🌍
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: theme === 'wandering' ? '#00e5ff' : 'var(--fg)', fontFamily: 'Teko, sans-serif', letterSpacing: 1 }}>
                行星发动机 · 流浪地球
              </span>
              <span style={{
                fontSize: 9, padding: '1px 6px', borderRadius: 3,
                background: hasWandering ? 'rgba(0,229,255,0.15)' : 'rgba(255,69,0,0.15)',
                color: hasWandering ? '#00e5ff' : '#ff4500',
                border: `1px solid ${hasWandering ? '#00e5ff' : '#ff4500'}`,
                fontFamily: 'Share Tech Mono, monospace'
              }}>
                {hasWandering ? 'UNLOCKED' : 'EXP REQ'}
              </span>
            </div>

            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
              UEG工业科幻控制台 & 深渊引擎重载模式
            </div>
          </div>

          {theme === 'wandering' ? (
            <span style={{ color: '#00e5ff', fontSize: 16, fontWeight: 'bold' }}>✓</span>
          ) : (
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '4px 10px',
              background: hasWandering ? '#00e5ff' : 'var(--border)',
              color: hasWandering ? '#07090e' : 'var(--muted)',
              borderRadius: 4, fontFamily: 'Share Tech Mono, monospace'
            }}>
              {hasWandering ? '装备' : '已锁定'}
            </span>
          )}
        </button>

        {/* 经验值解锁进度 */}
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted)', fontFamily: 'Share Tech Mono, monospace', marginBottom: 4 }}>
            <span>解锁阈值: 1000 XP (Lv.2+)</span>
            <span style={{ color: expQualified ? '#00e5ff' : '#ff4500' }}>{effectiveExp} / 1000 XP</span>
          </div>
          <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${expPct}%`,
              background: expQualified ? 'linear-gradient(90deg, #00e5ff, #ff4500)' : '#ff4500',
              transition: 'width 0.5s ease',
              boxShadow: '0 0 8px rgba(255, 69, 0, 0.5)'
            }} />
          </div>
        </div>
      </div>
    </div>
  )
}

function showToast(msg: string) {
  const el = document.createElement('div')
  el.textContent = msg
  el.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:9999;background:rgba(0,0,0,0.9);color:#00e5ff;padding:10px 20px;border-radius:8px;font-size:13px;border:1px solid #00e5ff;font-family:Share Tech Mono, monospace;box-shadow:0 0 15px rgba(0,229,255,0.3);'
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 2500)
}
