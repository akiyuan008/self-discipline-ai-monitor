import { useEffect } from 'react'
import { useStore } from '@/stores/useStore'
import Icon from '@/components/Icons'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useStore(s => s.theme)
  const darkModeMode = useStore(s => s.darkModeMode || 'system')

  useEffect(() => {
    const applyTheme = () => {
      const isWandering = theme === 'wandering'
      let isDark = false
      if (darkModeMode === 'system') {
        isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      } else if (darkModeMode === 'dark') {
        isDark = true
      } else {
        isDark = false
      }

      if (isWandering) {
        document.documentElement.setAttribute('data-theme', 'wandering')
      } else if (isDark) {
        document.documentElement.setAttribute('data-theme', 'dark')
      } else {
        document.documentElement.setAttribute('data-theme', 'light')
      }

      if (isDark) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }

    applyTheme()

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = () => {
      if (darkModeMode === 'system') {
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
  const setTheme = useStore(s => s.setTheme)

  const isWandering = theme === 'wandering'

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

      {/* 外观暗色模式选择 */}
      <div style={{ marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--fg)' }}>
          外观颜色模式
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {(['system', 'light', 'dark'] as const).map(m => {
            const labelMap = { system: '跟随系统', light: '浅色模式', dark: '深色模式' }
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
          <div style={{ fontSize: 16, fontWeight: 700 }}>
            主题皮肤选择
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
            切换应用整体视觉风格
          </div>
        </div>
        <div style={{
          padding: '4px 10px', borderRadius: 4,
          background: 'var(--bg-alt)',
          color: 'var(--muted)',
          border: '1px solid var(--border)',
          fontSize: 10, fontWeight: 700
        }}>
          {isWandering ? 'WANDERING' : 'DEFAULT'}
        </div>
      </div>

      {/* 默认主题：APK 旧版本简洁风格 */}
      <button onClick={() => { setTheme('default'); showToast('已切换至默认主题') }} style={{
        width: '100%', padding: '12px 14px', marginBottom: 10,
        background: theme === 'default' ? 'var(--accent-dim)' : 'var(--bg-alt)',
        border: theme === 'default' ? '1px solid var(--accent)' : '1px solid var(--border)',
        color: theme === 'default' ? 'var(--accent)' : 'var(--fg)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
        borderRadius: 10,
        textAlign: 'left'
      }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'linear-gradient(135deg, #F4F3F0, #E0DED9)', border: '1px solid rgba(0,0,0,0.1)', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>默认主题 (Default)</div>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>经典简洁双色主题</div>
        </div>
        {theme === 'default' && <span style={{ color: 'var(--accent)', fontSize: 16, fontWeight: 'bold' }}>✓</span>}
      </button>

      {/* 流浪地球主题：原项目 default 极简风格 */}
      <button onClick={() => { setTheme('wandering'); showToast('流浪地球主题已启用！') }} style={{
        width: '100%', padding: '12px 14px',
        background: theme === 'wandering' ? 'var(--accent-dim)' : 'var(--bg-alt)',
        border: theme === 'wandering' ? '1px solid var(--accent)' : '1px solid var(--border)',
        color: theme === 'wandering' ? 'var(--accent)' : 'var(--fg)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
        borderRadius: 10,
        textAlign: 'left'
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 8,
          background: 'linear-gradient(135deg, #2563eb, #38bdf8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0
        }}>
          <Icon.Globe size={20} color="#fff" />
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: theme === 'wandering' ? 'var(--accent)' : 'var(--fg)' }}>
              流浪地球
            </span>
            <span style={{
              fontSize: 9, padding: '1px 6px', borderRadius: 3,
              background: 'var(--accent-dim)',
              color: 'var(--accent)',
              border: '1px solid var(--accent)'
            }}>
              DEFAULT+
            </span>
          </div>

          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
            现代极简控制台风格
          </div>
        </div>

        {theme === 'wandering' ? (
          <span style={{ color: 'var(--accent)', fontSize: 16, fontWeight: 'bold' }}>✓</span>
        ) : (
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '4px 10px',
            background: 'var(--accent)',
            color: '#fff',
            borderRadius: 4
          }}>
            装备
          </span>
        )}
      </button>
    </div>
  )
}

function showToast(msg: string) {
  const el = document.createElement('div')
  el.textContent = msg
  el.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:9999;background:rgba(0,0,0,0.9);color:var(--accent);padding:10px 20px;border-radius:8px;font-size:13px;border:1px solid var(--accent);box-shadow:0 0 15px var(--accent-dim);'
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 2500)
}
