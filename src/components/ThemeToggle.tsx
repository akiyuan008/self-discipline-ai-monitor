import { useEffect } from 'react'
import { useStore } from '@/stores/useStore'
import Icon from '@/components/Icons'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const appMode = useStore(s => s.appMode)
  const darkModeMode = useStore(s => s.darkModeMode || 'system')

  useEffect(() => {
    const applyTheme = () => {
      const isGrowth = appMode === 'growth'
      let isDark = false
      if (darkModeMode === 'system') {
        isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      } else if (darkModeMode === 'dark') {
        isDark = true
      } else {
        isDark = false
      }

      // data-theme 仅作样式命中机制；产品概念是 App Mode（Normal/Growth 两套逻辑）
      if (isGrowth) {
        document.documentElement.setAttribute('data-theme', 'growth')
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
  }, [appMode, darkModeMode])

  return <>{children}</>
}

export function ThemeToggle() {
  const appMode = useStore(s => s.appMode)
  const darkModeMode = useStore(s => s.darkModeMode || 'system')
  const setDarkModeMode = useStore(s => s.setDarkModeMode)
  const setAppMode = useStore(s => s.setAppMode)

  const isGrowth = appMode === 'growth'

  return (
    <div style={{
      padding: '16px', borderRadius: 12,
      background: 'var(--card-bg)', border: '1px solid var(--border)',
      marginBottom: 12, position: 'relative'
    }}>
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

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>
            App 模式
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
            两套不同的产品逻辑，不是换肤
          </div>
        </div>
        <div style={{
          padding: '4px 10px', borderRadius: 4,
          background: 'var(--bg-alt)',
          color: 'var(--muted)',
          border: '1px solid var(--border)',
          fontSize: 10, fontWeight: 700
        }}>
          {isGrowth ? 'GROWTH' : 'NORMAL'}
        </div>
      </div>

      {/* Normal 模式 */}
      <button onClick={() => { setAppMode('normal'); showToast('已切换到 Normal 模式') }} style={{
        width: '100%', padding: '12px 14px', marginBottom: 10,
        background: appMode === 'normal' ? 'var(--accent-dim)' : 'var(--bg-alt)',
        border: appMode === 'normal' ? '1px solid var(--accent)' : '1px solid var(--border)',
        color: appMode === 'normal' ? 'var(--accent)' : 'var(--fg)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
        borderRadius: 10,
        textAlign: 'left'
      }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'linear-gradient(135deg, #F4F3F0, #E0DED9)', border: '1px solid rgba(0,0,0,0.1)', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Normal · 任务执行系统</div>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>完成今天的事</div>
        </div>
        {appMode === 'normal' && <span style={{ color: 'var(--accent)', fontSize: 16, fontWeight: 'bold' }}>✓</span>}
      </button>

      {/* Growth 模式 */}
      <button onClick={() => { setAppMode('growth'); showToast('已切换到 Growth 模式') }} style={{
        width: '100%', padding: '12px 14px',
        background: appMode === 'growth' ? 'var(--accent-dim)' : 'var(--bg-alt)',
        border: appMode === 'growth' ? '1px solid var(--accent)' : '1px solid var(--border)',
        color: appMode === 'growth' ? 'var(--accent)' : 'var(--fg)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
        borderRadius: 10,
        textAlign: 'left'
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 8,
          background: 'linear-gradient(135deg, #41705c, #d9974e)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0
        }}>
          <Icon.Sprout size={20} color="#fff" />
        </div>

        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: appMode === 'growth' ? 'var(--accent)' : 'var(--fg)' }}>
            Growth · 个人成长系统
          </span>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
            培养能力，看见自己的长期变化
          </div>
        </div>

        {appMode === 'growth' ? (
          <span style={{ color: 'var(--accent)', fontSize: 16, fontWeight: 'bold' }}>✓</span>
        ) : (
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '4px 10px',
            background: 'var(--accent)',
            color: '#fff',
            borderRadius: 4
          }}>
            体验
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
