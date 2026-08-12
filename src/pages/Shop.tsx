import { useState } from 'react'
import { useStore, type PageId } from '@/stores/useStore'
import { SHOP_ITEMS, type ShopItem } from '@/data/shop'
import { showToast } from '@/components/Toast'
import { logger } from '@/lib/logger'
import Icon from '@/components/Icons'

interface Props {
  onNavigate?: (p: PageId) => void
}

const CLIP = 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)'
const CLIP_SM = 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)'

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

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', background: 'var(--bg-alt)',
    color: 'var(--fg)', border: '1px solid var(--border)',
    fontSize: 13, outline: 'none', marginBottom: 8, boxSizing: 'border-box',
    fontFamily: 'Share Tech Mono, monospace', clipPath: CLIP_SM
  }

  return (
    <div className="safe-top animate-in" style={{ padding: '20px 16px 140px', background: 'var(--bg)', minHeight: '100vh' }}>
      {/* 顶部 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid rgba(69, 162, 158, 0.2)'
      }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'Share Tech Mono, monospace', letterSpacing: 2 }}>
            SUPPLY DEPOT
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif", letterSpacing: 2, margin: 0 }}>
            补给大楼
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <button
            onClick={() => setEditMode(!editMode)}
            style={{
              padding: '6px 12px', background: editMode ? 'rgba(69,162,158,0.15)' : 'var(--bg-alt)',
              border: `1px solid ${editMode ? '#45a29e' : 'var(--border)'}`,
              color: editMode ? '#45a29e' : 'var(--muted)',
              fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif", fontSize: 12, letterSpacing: 1,
              cursor: 'pointer', clipPath: CLIP_SM
            }}
          >{editMode ? '完成' : '编辑'}</button>
          <div style={{ textAlign: 'right' }} onClick={() => onNavigate?.('pointsDetail')}>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'Share Tech Mono, monospace' }}>CREDITS</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#f59e0b', fontFamily: 'Teko, sans-serif', cursor: 'pointer' }}>{points}</div>
          </div>
        </div>
      </div>

      {/* 添加表单 */}
      {editMode && showAddForm && (
        <div style={{
          background: 'var(--card-bg)', border: '1px solid #45a29e', padding: '14px',
          marginBottom: 12, position: 'relative', clipPath: CLIP
        }}>
          <div style={{ fontSize: 12, color: '#45a29e', fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif", letterSpacing: 1, marginBottom: 10 }}>
            添加道具
          </div>
          <input placeholder="道具名称" value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} style={inputStyle} />
          <input placeholder="道具描述" value={newItem.desc} onChange={e => setNewItem({ ...newItem, desc: e.target.value })} style={inputStyle} />
          <input type="number" placeholder="积分价格" value={newItem.cost} onChange={e => setNewItem({ ...newItem, cost: Number(e.target.value) || 0 })} style={inputStyle} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => {
                if (!newItem.name.trim()) { showToast('请输入名称'); return }
                addCustom({
                  name: newItem.name.trim(),
                  desc: newItem.desc.trim() || '自定义道具',
                  cost: Math.max(1, newItem.cost),
                  iconBg: 'rgba(69,162,158,0.12)',
                  iconColor: '#45a29e',
                  iconPath: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z',
                  effect: 'snack'
                })
                setNewItem({ name: '', desc: '', cost: 100 })
                setShowAddForm(false)
                logger.info('shop', `添加自定义道具：${newItem.name.trim()}`, { cost: Math.max(1, newItem.cost) })
                showToast('道具已添加')
              }}
              style={{ flex: 1, padding: '9px', background: 'rgba(69,162,158,0.15)', border: '1px solid #45a29e', color: '#45a29e', fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif", fontSize: 13, letterSpacing: 1, cursor: 'pointer', clipPath: CLIP_SM }}
            >确认添加</button>
            <button
              onClick={() => setShowAddForm(false)}
              style={{ flex: 1, padding: '9px', background: 'var(--bg-alt)', border: '1px solid var(--border)', color: 'var(--muted)', fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif", fontSize: 13, letterSpacing: 1, cursor: 'pointer', clipPath: CLIP_SM }}
            >取消</button>
          </div>
        </div>
      )}

      {/* 添加按钮 */}
      {editMode && !showAddForm && (
        <button
          onClick={() => setShowAddForm(true)}
          style={{
            width: '100%', padding: '14px', marginBottom: 10,
            background: 'transparent', border: '1px dashed #45a29e', color: '#45a29e',
            fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif", fontSize: 13, letterSpacing: 1,
            cursor: 'pointer', clipPath: CLIP, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
          }}
        ><Icon.More size={14} color="#45a29e" /> 添加自定义道具</button>
      )}

      {/* 商品网格 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {allItems.map(item => {
          const isCustom = customItems.some(ci => ci.id === item.id)
          const canBuy = !item.lockLevel || streak >= item.lockLevel
          const enough = points >= item.cost
          const ownedCount = owned[item.id] ?? 0

          return (
            <div key={item.id} style={{
              background: 'var(--card-bg)', border: '1px solid var(--border)',
              padding: '14px', position: 'relative', clipPath: CLIP,
              opacity: canBuy ? 1 : 0.45, filter: canBuy ? 'none' : 'grayscale(1)'
            }}>
              <div className="corner-deco tl" style={{ width: 8, height: 8, borderWidth: 1 }} />
              <div className="corner-deco br" style={{ width: 8, height: 8, borderWidth: 1 }} />

              {editMode && isCustom && (
                <button
                  onClick={() => { removeCustom(item.id); showToast('已删除') }}
                  style={{
                    position: 'absolute', top: 8, right: 8, width: 22, height: 22,
                    background: 'rgba(255,68,68,0.15)', border: '1px solid #ff4444',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 10, clipPath: CLIP_SM
                  }}
                ><Icon.Close size={12} color="#ff4444" /></button>
              )}

              {item.badge && (
                <div style={{
                  position: 'absolute', top: 8, right: editMode && isCustom ? 36 : 8,
                  padding: '1px 6px', background: 'rgba(255,69,0,0.15)',
                  border: '1px solid #ff4500', color: '#ff4500',
                  fontSize: 8, fontWeight: 700, fontFamily: 'Share Tech Mono, monospace', letterSpacing: 1
                }}>{item.badge}</div>
              )}

              <div style={{
                width: 42, height: 42, background: item.iconBg,
                border: `1px solid ${item.iconColor}40`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 10, clipPath: CLIP_SM
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={item.iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={item.iconPath} />
                </svg>
              </div>

              <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif", letterSpacing: 1, marginBottom: 2 }}>
                {item.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif", marginBottom: 10, minHeight: 26, lineHeight: 1.4 }}>
                {item.lockLevel && !canBuy ? `连签 ${item.lockLevel} 天解锁` : item.desc}
              </div>

              <button
                disabled={!canBuy || !enough || editMode}
                onClick={() => {
                  if (buy(item.id)) {
                    logger.info('shop', `购买道具：${item.name}`, { cost: item.cost, id: item.id })
                    showToast(`兑换成功：${item.name}${ownedCount > 0 ? ` (×${ownedCount + 1})` : ''}`)
                  } else {
                    logger.warn('shop', `购买失败：${item.name}`, { cost: item.cost, points })
                    showToast('积分不足或已达上限')
                  }
                }}
                style={{
                  width: '100%', padding: '7px',
                  background: canBuy && enough && !editMode ? 'rgba(245,158,11,0.12)' : 'var(--bg-alt)',
                  border: `1px solid ${canBuy && enough && !editMode ? '#f59e0b' : 'var(--border)'}`,
                  color: canBuy && enough && !editMode ? '#f59e0b' : 'var(--muted)',
                  fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif", fontSize: 12, letterSpacing: 1,
                  cursor: canBuy && enough && !editMode ? 'pointer' : 'default', clipPath: CLIP_SM
                }}
              >
                {item.cost} 积分{ownedCount > 0 ? ` · ×${ownedCount}` : ''}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
