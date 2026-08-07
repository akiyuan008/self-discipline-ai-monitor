import { useState } from 'react'
import { useStore, type PageId } from '@/stores/useStore'
import { SHOP_ITEMS, type ShopItem } from '@/data/shop'
import { showToast } from '@/components/Toast'

interface Props {
  onNavigate?: (p: PageId) => void
}

export default function Shop({ onNavigate }: Props) {
  const points = useStore(s => s.points)
  const owned = useStore(s => s.ownedItems)
  const buy = useStore(s => s.buyItem)
  const streak = useStore(s => s.streak)
  const customItems = useStore(s => s.customShopItems)
  const addCustom = useStore(s => s.addCustomShopItem)
  const removeCustom = useStore(s => s.removeCustomShopItem)

  const [editMode, setEditMode] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newItem, setNewItem] = useState({ name: '', desc: '', cost: 100 })

  const allItems = [...SHOP_ITEMS, ...customItems]

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
        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
          <button
            onClick={() => setEditMode(!editMode)}
            style={{
              background: 'var(--bg-alt)', border: '1px solid var(--border)',
              borderRadius: 100, padding: '6px 12px',
              fontSize: 11, fontWeight: 600, color: editMode ? 'var(--bg)' : 'var(--fg)',
              cursor: 'pointer',
              background: editMode ? 'var(--fg)' : 'var(--bg-alt)'
            }}
          >{editMode ? '完成' : '编辑'}</button>
          <button
            onClick={() => onNavigate?.('pointsDetail')}
            style={{
              background: 'none', border: 'none',
              fontSize: 18, fontWeight: 600, fontFamily: 'DM Mono, monospace',
              color: 'var(--fg)', cursor: 'pointer',
              display: 'flex', alignItems: 'baseline', gap: 4
            }}
          >
            {points}
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>PTS ›</span>
          </button>
        </div>
      </div>

      {/* 添加新道具表单 */}
      {editMode && showAddForm && (
        <div className="card" style={{ padding: 16, borderRadius: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>添加自定义道具</div>
          <input
            placeholder="道具名称"
            value={newItem.name}
            onChange={e => setNewItem({ ...newItem, name: e.target.value })}
            style={{ width: '100%', padding: '10px 12px', background: 'var(--bg)', color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, outline: 'none', marginBottom: 8, boxSizing: 'border-box' }}
          />
          <input
            placeholder="道具描述"
            value={newItem.desc}
            onChange={e => setNewItem({ ...newItem, desc: e.target.value })}
            style={{ width: '100%', padding: '10px 12px', background: 'var(--bg)', color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, outline: 'none', marginBottom: 8, boxSizing: 'border-box' }}
          />
          <input
            type="number"
            placeholder="积分价格"
            value={newItem.cost}
            onChange={e => setNewItem({ ...newItem, cost: Number(e.target.value) || 0 })}
            style={{ width: '100%', padding: '10px 12px', background: 'var(--bg)', color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, outline: 'none', marginBottom: 12, boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => {
                if (!newItem.name.trim()) { showToast('请输入名称'); return }
                addCustom({
                  name: newItem.name.trim(),
                  desc: newItem.desc.trim() || '自定义道具',
                  cost: Math.max(1, newItem.cost),
                  iconBg: 'rgba(139, 92, 246, 0.1)',
                  iconColor: '#8b5cf6',
                  iconPath: 'M12 2L2 7L12 12L22 7L12 2M2 17L12 22L22 17M2 12L12 17L22 12',
                  effect: 'snack'
                })
                setNewItem({ name: '', desc: '', cost: 100 })
                setShowAddForm(false)
                showToast('道具已添加')
              }}
              style={{ flex: 1, padding: '10px', borderRadius: 8, background: 'var(--fg)', color: 'var(--bg)', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >确认添加</button>
            <button
              onClick={() => setShowAddForm(false)}
              style={{ flex: 1, padding: '10px', borderRadius: 8, background: 'var(--bg-alt)', color: 'var(--fg)', border: '1px solid var(--border)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >取消</button>
          </div>
        </div>
      )}

      {/* 添加按钮 */}
      {editMode && !showAddForm && (
        <button
          onClick={() => setShowAddForm(true)}
          className="card"
          style={{
            width: '100%', padding: '14px', borderRadius: 16, marginBottom: 10,
            background: 'var(--bg-alt)', border: '2px dashed var(--border)',
            fontSize: 13, fontWeight: 600, color: 'var(--muted)', cursor: 'pointer'
          }}
        >+ 添加自定义道具</button>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 10
      }}>
        {allItems.map(item => {
          const isCustom = customItems.some(c => c.id === item.id)
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
              {editMode && isCustom && (
                <button
                  onClick={() => { removeCustom(item.id); showToast('已删除') }}
                  style={{
                    position: 'absolute', top: 6, right: 6,
                    width: 24, height: 24, borderRadius: '50%',
                    background: 'var(--danger)', color: '#fff',
                    border: 'none', fontSize: 14, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 10
                  }}
                >×</button>
              )}

              {item.badge && (
                <div style={{
                  position: 'absolute',
                  top: 8, right: editMode && isCustom ? 36 : 8,
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
                disabled={!canBuy || !enough || editMode}
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
                  background: canBuy && enough && !editMode ? 'var(--fg)' : 'var(--bg-alt)',
                  color: canBuy && enough && !editMode ? 'var(--bg)' : 'var(--muted)',
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: canBuy && enough && !editMode ? 'pointer' : 'default'
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
