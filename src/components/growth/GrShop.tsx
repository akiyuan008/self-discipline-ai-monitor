/**
 * src/components/growth/GrShop.tsx
 * Growth Mode Shop — 成长商店。温暖、中文为主的积分兑换页。
 * 复用现有 Shop 业务逻辑（SHOP_ITEMS, buy, customItems）。
 */
import { useState } from 'react'
import { useStore, type PageId } from '@/stores/useStore'
import { SHOP_ITEMS } from '@/data/shop'
import { showToast } from '@/components/Toast'
import { logger } from '@/lib/logger'
import Icon from '@/components/Icons'

interface Props { onNavigate?: (p: PageId) => void }

export default function GrShop({ onNavigate }: Props) {
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
    <div className="gr-page">
      {/* 标题 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 14, color: 'var(--growth-text-secondary)', marginBottom: 2 }}>成长商店</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--growth-text)' }}>积分兑换</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <button onClick={() => setEditMode(!editMode)} className="gr-btn gr-btn-outline" style={{ padding: '6px 14px', fontSize: 12 }}>
            {editMode ? '完成' : '编辑'}
          </button>
          <div style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => onNavigate?.('pointsDetail')}>
            <div style={{ fontSize: 11, color: 'var(--growth-text-secondary)' }}>成长值</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--growth-warm)' }}>{points}</div>
          </div>
        </div>
      </div>

      {/* 添加表单 */}
      {editMode && showAddForm && (
        <div className="gr-card" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--growth-text)', marginBottom: 10 }}>添加道具</div>
          <input placeholder="道具名称" value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })}
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', marginBottom: 8, background: 'var(--growth-surface-alt)', border: '1px solid var(--growth-border)', borderRadius: 'var(--growth-radius-sm)', color: 'var(--growth-text)', fontSize: 14, outline: 'none' }} />
          <input placeholder="道具描述" value={newItem.desc} onChange={e => setNewItem({ ...newItem, desc: e.target.value })}
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', marginBottom: 8, background: 'var(--growth-surface-alt)', border: '1px solid var(--growth-border)', borderRadius: 'var(--growth-radius-sm)', color: 'var(--growth-text)', fontSize: 14, outline: 'none' }} />
          <input type="number" placeholder="积分价格" value={newItem.cost} onChange={e => setNewItem({ ...newItem, cost: Number(e.target.value) || 0 })}
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', marginBottom: 10, background: 'var(--growth-surface-alt)', border: '1px solid var(--growth-border)', borderRadius: 'var(--growth-radius-sm)', color: 'var(--growth-text)', fontSize: 14, outline: 'none' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="gr-btn gr-btn-primary" style={{ flex: 1 }} onClick={() => {
              if (!newItem.name.trim()) { showToast('请输入名称'); return }
              addCustom({ name: newItem.name.trim(), desc: newItem.desc.trim() || '自定义道具', cost: Math.max(1, newItem.cost), iconBg: 'rgba(124,108,171,0.08)', iconColor: 'var(--growth-primary)', iconPath: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z', effect: 'snack' })
              setNewItem({ name: '', desc: '', cost: 100 }); setShowAddForm(false)
              showToast('道具已添加')
            }}>确认添加</button>
            <button className="gr-btn gr-btn-outline" style={{ flex: 1 }} onClick={() => setShowAddForm(false)}>取消</button>
          </div>
        </div>
      )}

      {/* 添加按钮 */}
      {editMode && !showAddForm && (
        <button className="gr-btn gr-btn-outline" style={{ width: '100%', marginBottom: 10, borderStyle: 'dashed' }} onClick={() => setShowAddForm(true)}>
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Icon.More size={14} color="var(--growth-primary)" /> 添加自定义道具
          </span>
        </button>
      )}

      {/* 商品网格 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {allItems.map(item => {
          const isCustom = customItems.some(ci => ci.id === item.id)
          const canBuy = !item.lockLevel || streak >= item.lockLevel
          const enough = points >= item.cost
          const ownedCount = owned[item.id] ?? 0
          return (
            <div key={item.id} className="gr-card" style={{ padding: 14, position: 'relative', opacity: canBuy ? 1 : 0.5 }}>
              {editMode && isCustom && (
                <button onClick={() => { removeCustom(item.id); showToast('已删除') }} style={{ position: 'absolute', top: 8, right: 8, width: 22, height: 22, background: 'rgba(192,80,74,0.1)', border: 'none', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                  <Icon.Close size={12} color="var(--danger)" />
                </button>
              )}
              {item.badge && (
                <div style={{ position: 'absolute', top: 8, right: editMode && isCustom ? 36 : 8, padding: '2px 8px', background: 'rgba(232,160,106,0.15)', borderRadius: 100, color: 'var(--growth-warm)', fontSize: 9, fontWeight: 700 }}>
                  {item.badge}
                </div>
              )}
              <div style={{ width: 42, height: 42, background: item.iconBg, borderRadius: 'var(--growth-radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={item.iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={item.iconPath} /></svg>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--growth-text)', marginBottom: 2 }}>{item.name}</div>
              <div style={{ fontSize: 11, color: 'var(--growth-text-secondary)', marginBottom: 10, minHeight: 26, lineHeight: 1.4 }}>
                {item.lockLevel && !canBuy ? `连签 ${item.lockLevel} 天解锁` : item.desc}
              </div>
              <button className="gr-btn" disabled={!canBuy || !enough || editMode} onClick={() => {
                if (buy(item.id)) { showToast(`兑换成功：${item.name}${ownedCount > 0 ? ` (×${ownedCount + 1})` : ''}`) }
                else { showToast('积分不足或已达上限') }
              }} style={{
                width: '100%', padding: '8px', fontSize: 12, borderRadius: 'var(--growth-radius-sm)',
                background: canBuy && enough && !editMode ? 'var(--growth-primary)' : 'var(--growth-surface-alt)',
                color: canBuy && enough && !editMode ? '#fff' : 'var(--growth-text-secondary)',
                border: 'none', cursor: canBuy && enough && !editMode ? 'pointer' : 'default'
              }}>
                {item.cost} 积分{ownedCount > 0 ? ` · ×${ownedCount}` : ''}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
