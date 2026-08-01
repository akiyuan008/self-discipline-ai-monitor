import { useState } from 'react'
import { useUserStore, currentPersona } from '@/stores/userStore'
import { WORLD_MAPS, PETS, ACHIEVEMENTS, RARITY_META, type Pet as PetType } from '@/data/world'
import { studyMinutesToday, focusScoreToday } from '@/stores/statsStore'

type Tab = 'world' | 'pet' | 'achievement'

export default function Pet() {
  const [tab, setTab] = useState<Tab>('pet')
  const persona = currentPersona()
  const energy = useUserStore(s => s.energy)

  return (
    <div className="px-4 pt-3 pb-4">
      <h1 className="text-xl font-bold mb-1">自律世界</h1>
      <p className="text-xs text-ink-3 mb-3">用自律能量 ⚡ 投喂监工养成，解锁地图与宠物</p>

      {/* 顶部能量 */}
      <div className="card p-4 mb-4 flex items-center gap-3 bg-gradient-to-r from-purple-50 to-blue-50">
        <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl breathe"
          style={{ background: persona.color + '18' }}>{persona.emoji}</div>
        <div className="flex-1">
          <p className="text-xs text-ink-3">自律能量</p>
          <p className="text-2xl font-bold text-brand">⚡ {energy}</p>
        </div>
        <div className="text-right text-[11px] text-ink-3">
          <p>今日学习 {Math.round(studyMinutesToday())}min</p>
          <p>专注度 {focusScoreToday()}</p>
        </div>
      </div>

      {/* 切换 */}
      <div className="bg-bg-soft rounded-pill p-1 flex mb-4">
        {[
          { id: 'pet', label: '🐾 宠物' },
          { id: 'world', label: '🗺️ 地图' },
          { id: 'achievement', label: '🏆 成就' }
        ].map(t => (
          <button key={t.id}
            onClick={() => setTab(t.id as Tab)}
            className={`flex-1 py-2 text-xs font-medium rounded-pill transition ${
              tab === t.id ? 'bg-white text-brand shadow' : 'text-ink-3'
            }`}
          >{t.label}</button>
        ))}
      </div>

      {tab === 'pet' && <PetTab persona={persona} />}
      {tab === 'world' && <WorldTab persona={persona} />}
      {tab === 'achievement' && <AchievementTab persona={persona} />}
    </div>
  )
}

function PetTab({ persona }: { persona: any }) {
  const unlockedPets = useUserStore(s => s.unlockedPets)
  const unlockPet = useUserStore(s => s.unlockPet)
  const setActivePet = useUserStore(s => s.setActivePet)
  const activePet = useUserStore(s => s.activePet)
  const energy = useUserStore(s => s.energy)
  const [toast, setToast] = useState<string | null>(null)

  function showToast(m: string) { setToast(m); setTimeout(() => setToast(null), 2000) }

  function tryUnlock(p: PetType) {
    if (unlockedPets.includes(p.id)) {
      setActivePet(p.id)
      showToast(`${p.name} 上场！`)
      return
    }
    if (energy < p.unlockCost) {
      showToast('能量不足')
      return
    }
    const ok = unlockPet(p.id)
    showToast(ok ? `解锁成功：${p.name}` : '解锁失败')
  }

  return (
    <div className="space-y-4">
      {/* 当前出战宠物 */}
      {activePet && (
        <div className="card p-5 text-center bg-gradient-to-b from-purple-50 to-white">
          <div className="text-6xl mb-2 breathe">{PETS.find(p => p.id === activePet)?.emoji}</div>
          <h3 className="font-bold text-lg">{PETS.find(p => p.id === activePet)?.name}</h3>
          <p className="text-xs text-ink-3 mt-1">{PETS.find(p => p.id === activePet)?.desc}</p>
          <p className="text-[11px] text-brand mt-2">正在陪学</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {PETS.map(p => {
          const unlocked = unlockedPets.includes(p.id)
          const active = activePet === p.id
          const affordable = energy >= p.unlockCost
          const rarity = RARITY_META[p.rarity]
          return (
            <div key={p.id}
              className={`card p-3 flex flex-col ${active ? 'ring-2 ring-brand' : ''}`}
              style={active ? { boxShadow: `0 0 0 2px ${persona.color}22, 0 4px 16px rgba(0,0,0,0.04)` } : {}}
            >
              <div className="flex justify-between items-start mb-1">
                <span className="chip" style={{ color: rarity.color, background: rarity.color + '14' }}>{rarity.label}</span>
                {active && <span className="chip bg-brand text-white text-[9px]">出战</span>}
              </div>
              <div className={`text-5xl text-center my-2 ${unlocked ? '' : 'grayscale opacity-50'}`}>{p.emoji}</div>
              <h3 className="font-semibold text-sm text-center">{p.name}</h3>
              <p className="text-[11px] text-ink-3 text-center mt-0.5 flex-1 leading-relaxed">{p.desc}</p>
              <div className="mt-2">
                {unlocked ? (
                  <button
                    onClick={() => tryUnlock(p)}
                    className={`w-full py-1.5 rounded-pill text-xs font-medium ${active ? 'bg-bg-soft text-ink-3' : 'bg-brand text-white'}`}
                  >{active ? '已出战' : '设为出战'}</button>
                ) : (
                  <button
                    onClick={() => tryUnlock(p)}
                    disabled={!affordable}
                    className={`w-full py-1.5 rounded-pill text-xs font-medium ${affordable ? 'bg-brand text-white' : 'bg-bg-soft text-ink-3'}`}
                  >⚡ {p.unlockCost}</button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 bg-black/80 text-white text-sm px-4 py-2 rounded-pill z-50">
          {toast}
        </div>
      )}
    </div>
  )
}

function WorldTab({ persona }: { persona: any }) {
  const unlockedMaps = useUserStore(s => s.unlockedMaps)
  const unlockMap = useUserStore(s => s.unlockMap)
  const energy = useUserStore(s => s.energy)
  const [toast, setToast] = useState<string | null>(null)

  function showToast(m: string) { setToast(m); setTimeout(() => setToast(null), 2000) }

  function tryUnlock(mapId: string) {
    const ok = unlockMap(mapId)
    showToast(ok ? '地图已解锁' : '能量不足或已解锁')
  }

  return (
    <div className="space-y-3">
      {WORLD_MAPS.map(m => {
        const unlocked = unlockedMaps.includes(m.id)
        const affordable = energy >= m.unlockCost
        return (
          <div key={m.id} className={`card p-4 flex items-center gap-4 ${unlocked ? '' : 'opacity-90'}`}>
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shrink-0 ${unlocked ? '' : 'grayscale'}`}
              style={{ background: (persona.color + '14') }}>
              {unlocked ? m.emoji : '🔒'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{m.name}</h3>
                {unlocked && <span className="chip bg-green-50 text-green-700 text-[9px]">已解锁</span>}
              </div>
              <p className="text-xs text-ink-3 mt-1 leading-relaxed">{m.desc}</p>
              {!unlocked && (
                <button
                  onClick={() => tryUnlock(m.id)}
                  disabled={!affordable}
                  className={`mt-2 px-3 py-1 rounded-pill text-xs font-medium ${affordable ? 'bg-brand text-white' : 'bg-bg-soft text-ink-3'}`}
                >⚡ {m.unlockCost} 解锁</button>
              )}
            </div>
          </div>
        )
      })}

      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 bg-black/80 text-white text-sm px-4 py-2 rounded-pill z-50">
          {toast}
        </div>
      )}
    </div>
  )
}

function AchievementTab({ persona }: { persona: any }) {
  const unlocked = ACHIEVEMENTS.filter(a => a.unlocked).length
  return (
    <div className="space-y-3">
      <div className="card p-4 text-center bg-gradient-to-b from-amber-50 to-white">
        <p className="text-xs text-ink-3">已解锁成就</p>
        <p className="text-3xl font-bold text-amber-500">{unlocked}<span className="text-sm font-normal text-ink-3">/{ACHIEVEMENTS.length}</span></p>
      </div>

      {ACHIEVEMENTS.map(a => (
        <div key={a.id} className={`card p-4 flex items-center gap-3 ${a.unlocked ? '' : 'opacity-70'}`}>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl shrink-0 ${a.unlocked ? '' : 'grayscale'}`}
            style={{ background: (a.unlocked ? '#f59e0b' : '#838A95') + '14' }}>
            {a.unlocked ? a.emoji : '🔒'}
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-sm">{a.name}</h3>
            <p className="text-xs text-ink-3 mt-0.5">{a.desc}</p>
            {a.progress != null && a.total != null && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-bg-soft rounded overflow-hidden">
                  <div className="h-full bg-amber-500 rounded"
                    style={{ width: `${(a.progress / a.total) * 100}%` }} />
                </div>
                <span className="text-[10px] text-ink-3">{a.progress}/{a.total}</span>
              </div>
            )}
          </div>
          {a.unlocked && <span className="text-amber-500 text-lg">✓</span>}
        </div>
      ))}
    </div>
  )
}
