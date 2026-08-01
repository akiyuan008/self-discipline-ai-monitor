import { useStore } from '@/stores/useStore'
import { SHOP_ITEMS } from '@/data/shop'
import { showToast } from '@/components/Toast'

export default function Shop() {
  const points = useStore(s => s.points)
  const owned = useStore(s => s.ownedItems)
  const buy = useStore(s => s.buyItem)
  const streak = useStore(s => s.streak)

  return (
    <div className="safe-top" style={{ padding: '24px 20px 140px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
            ITEM_SHOP
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5, marginBottom: 0 }}>
            补给站
          </h1>
        </div>
        <div style={{ fontSize: 18, fontWeight: 600, fontFamily: 'DM Mono, monospace' }}>
          {points}
          <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 4 }}>PTS</span>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 10
      }}>
        {SHOP_ITEMS.map(item => {
          const canBuy = !item.lockLevel || streak >= item.lockLevel
          const enough = points >= item.cost
          const ownedCount = owned[item.id] ?? 0

          return (
            <div
              key={item.id}
              className="card"
              style={{
                padding: 16,
                borderRadius: 16,
                position: 'relative',
                opacity: canBuy ? 1 : 0.5,
                filter: canBuy ? 'none' : 'grayscale(1)'
              }}
            >
              {item.badge && (
                <div style={{
                  position: 'absolute',
                  top: 8, right: 8,
                  padding: '2px 6px',
                  background: 'var(--danger)',
                  color: '#fff',
                  fontSize: 9,
                  fontWeight: 700,
                  borderRadius: 100
                }}>
                  {item.badge}
                </div>
              )}

              <div style={{
                width: 44, height: 44,
                borderRadius: 12,
                background: item.iconBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 12
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill={item.iconColor}>
                  <path d={item.iconPath} />
                </svg>
              </div>

              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>
                {item.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12, minHeight: 28 }}>
                {item.lockLevel && !canBuy ? `Lv.${item.lockLevel} 解锁` : item.desc}
              </div>

              <button
                disabled={!canBuy || !enough}
                onClick={() => {
                  if (buy(item.id)) {
                    showToast(`购买成功：${item.name}${ownedCount > 0 ? ` (×${ownedCount + 1})` : ''}`)
                  } else {
                    showToast('积分不足')
                  }
                }}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: 8,
                  background: canBuy && enough ? 'var(--fg)' : 'var(--bg-alt)',
                  color: canBuy && enough ? 'var(--bg)' : 'var(--muted)',
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: canBuy && enough ? 'pointer' : 'not-allowed'
                }}
              >
                {item.cost} PTS
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
