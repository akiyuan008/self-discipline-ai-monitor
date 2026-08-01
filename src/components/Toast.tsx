import { useEffect, useState } from 'react'

let toastTimer: number | undefined
let externalSet: ((text: string) => void) | null = null

export function showToast(text: string) {
  externalSet?.(text)
}

export default function Toast() {
  const [text, setText] = useState('')
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    externalSet = (t: string) => {
      setText(t)
      setVisible(true)
      window.clearTimeout(toastTimer)
      toastTimer = window.setTimeout(() => setVisible(false), 2000)
    }
    return () => { externalSet = null }
  }, [])

  if (!visible) return null
  return (
    <div
      style={{
        position: 'fixed',
        top: 'max(16px, env(safe-area-inset-top))',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'var(--fg)',
        color: 'var(--bg)',
        padding: '12px 24px',
        borderRadius: 100,
        fontSize: 14,
        fontWeight: 500,
        zIndex: 200,
        whiteSpace: 'nowrap',
        boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
      }}
      className="animate-in"
    >
      {text}
    </div>
  )
}
