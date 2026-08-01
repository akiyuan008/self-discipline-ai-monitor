import { useUserStore } from '@/stores/userStore'
import { PERSONAS, type PersonaId } from '@/data/personas'
import { currentPersona } from '@/stores/userStore'
import { lockScreenMinutes } from '@/lib/usageStats'

export default function Settings() {
  const u = useUserStore()
  const persona = currentPersona()

  return (
    <div className="px-4 pt-3 pb-4">
      <h1 className="text-xl font-bold mb-3">设置</h1>

      {/* 用户卡 */}
      <div className="card p-4 mb-4 flex items-center gap-3">
        <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl"
          style={{ background: persona.color + '18' }}>{persona.emoji}</div>
        <div className="flex-1">
          <p className="font-semibold">{u.nickname || '同学'}</p>
          <p className="text-xs text-ink-3">监工：{persona.name} · {persona.tagline}</p>
        </div>
      </div>

      {/* 监工人格切换 */}
      <div className="card p-4 mb-4">
        <h3 className="font-semibold mb-3">切换监工人格</h3>
        <div className="grid grid-cols-3 gap-2">
          {PERSONAS.map(p => (
            <button key={p.id}
              onClick={() => u.setPersona(p.id as PersonaId)}
              className={`p-3 rounded-2xl flex flex-col items-center gap-1 transition ${
                u.personaId === p.id ? 'bg-bg-soft ring-2 ring-brand' : 'bg-white border border-stroke'
              }`}
            >
              <span className="text-2xl">{p.emoji}</span>
              <span className="text-xs font-medium" style={{ color: p.color }}>{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 每日目标 */}
      <div className="card p-4 mb-4">
        <div className="flex justify-between items-baseline mb-3">
          <h3 className="font-semibold">每日学习目标</h3>
          <span className="text-brand font-bold">{u.dailyGoalMin}<span className="text-xs font-normal text-ink-3 ml-1">分钟</span></span>
        </div>
        <input
          type="range" min={30} max={360} step={30}
          value={u.dailyGoalMin}
          onChange={e => {
            const v = +e.target.value
            // Zustand 没有直接 setter，用 init 重设
            useUserStore.setState({ dailyGoalMin: v })
          }}
          className="w-full accent-brand"
        />
      </div>

      {/* 资源余额 */}
      <div className="card p-4 mb-4">
        <h3 className="font-semibold mb-3">资源余额</h3>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-bg-soft rounded-xl p-3">
            <p className="text-2xl">💎</p>
            <p className="text-xl font-bold text-brand mt-1">{u.points}</p>
            <p className="text-[10px] text-ink-3">积分</p>
          </div>
          <div className="bg-bg-soft rounded-xl p-3">
            <p className="text-2xl">⚡</p>
            <p className="text-xl font-bold text-brand mt-1">{u.energy}</p>
            <p className="text-[10px] text-ink-3">能量</p>
          </div>
          <div className="bg-bg-soft rounded-xl p-3">
            <p className="text-2xl">🛡️</p>
            <p className="text-xl font-bold text-brand mt-1">{u.pardonCards}</p>
            <p className="text-[10px] text-ink-3">免罚</p>
          </div>
        </div>
      </div>

      {/* 情绪关怀测试 */}
      <div className="card p-4 mb-4">
        <h3 className="font-semibold mb-3">情绪关怀 / 强制锁屏</h3>
        <p className="text-xs text-ink-3 mb-3 leading-relaxed">
          真机环境会通过 DevicePolicyManager 或屏幕遮罩实现锁屏。Web 预览下为模拟弹窗。
        </p>
        <button
          className="btn-ghost w-full mb-2"
          onClick={() => lockScreenMinutes(5)}
        >测试锁屏 5 分钟</button>
        <button
          className="btn-ghost w-full"
          onClick={() => alert(`${persona.greeting}\n\n本模式由 AI 监工根据时段、连续学习时长、连续低分动态触发。`)}
        >查看触发条件</button>
      </div>

      {/* 危险区 */}
      <div className="card p-4 mb-4 border border-rose-200">
        <h3 className="font-semibold text-rose-600 mb-2">危险操作</h3>
        <p className="text-xs text-ink-3 mb-3">重置后所有进度、积分、解锁、宠物都将清空。</p>
        <button
          className="bg-rose-500 text-white rounded-pill w-full py-2.5 text-sm font-medium"
          onClick={() => {
            if (window.confirm('确定重置全部进度？此操作不可逆。')) {
              u.reset()
              location.hash = '#/onboarding'
            }
          }}
        >重置全部进度</button>
      </div>

      <p className="text-center text-[10px] text-ink-3 py-4">自律养成 · AI监工 v1.0<br />基于 React + Capacitor · z-ai-web-dev-sdk</p>
    </div>
  )
}
