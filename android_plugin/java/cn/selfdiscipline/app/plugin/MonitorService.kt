package cn.selfdiscipline.app.plugin

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.util.Log
import com.getcapacitor.JSObject
import java.util.Calendar

/**
 * MonitorService
 *
 * 长期前台服务：周期性轮询 UsageStats。
 *
 * 【第三阶段改造】本服务不再自己维护 App 分类、也不再独立判断任务完成，
 * 职责收敛为「行为采集 + 系统级干预」：
 *  - 分类统一消费 AppCategories（由 config/appCategories.json 构建时生成，唯一 Source of Truth）；
 *  - 检测到前台 App 变化 → 产 APP_FOREGROUND BehaviorEvent 发给 TS DisciplineEngine；
 *  - 通过 MissionMirror 读取当前 Mission 最小镜像，感知"是否有任务在执行"；
 *  - 保留深夜关怀 / 连续学习关怀等系统级健康提醒。
 *
 * 任务是否分心、是否干预、是否完成，统一由 TS DisciplineEngine 判定（决策 #6）。
 */
class MonitorService : Service() {

  private val TAG = "MonitorService"
  private val handler = Handler(Looper.getMainLooper())
  private val intervalMs = 60_000L // 每分钟轮询
  private var consecutiveStudyMin = 0
  private var lastForegroundPkg: String? = null

  private val poller = object : Runnable {
    override fun run() {
      try {
        pollUsage()
      } catch (e: Exception) {
        Log.e(TAG, "poll error", e)
      }
      handler.postDelayed(this, intervalMs)
    }
  }

  override fun onCreate() {
    super.onCreate()
    createChannel()
    val notif = Notification.Builder(this, CHANNEL_ID)
      .setContentTitle("AI 监工运行中")
      .setContentText("守护你的自律节奏")
      .setSmallIcon(android.R.drawable.ic_menu_view)
      .setOngoing(true)
      .build()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      startForeground(NOTIF_ID, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
    } else {
      startForeground(NOTIF_ID, notif)
    }
    handler.post(poller)
    // 重启后从最小镜像恢复"是否有 Mission 在执行"的感知（决策 #5 双保险）
    val hasMission = MissionMirror.hasActiveMission(this)
    Log.d(TAG, "MonitorService onCreate, activeMission=$hasMission")
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_STICKY

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onDestroy() {
    handler.removeCallbacks(poller)
    super.onDestroy()
  }

  // ----------------------------------------------------------------------
  private fun pollUsage() {
    val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
    if (!pm.isInteractive) {
      // 屏幕黑了就清零
      consecutiveStudyMin = 0
      return
    }

    val cal = Calendar.getInstance()
    val end = System.currentTimeMillis()
    cal.add(Calendar.MINUTE, -1)
    val start = cal.timeInMillis

    val usm = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val stats = usm.queryAndAggregateUsageStats(start, end) ?: return
    if (stats.isEmpty()) return

    // 找出当前最近使用的应用
    val latest = stats.maxByOrNull { it.value.lastTimeUsed } ?: return
    val pkg = latest.key
    val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)

    // ── 产 APP_FOREGROUND BehaviorEvent（前台 App 变化时）→ TS DisciplineEngine ──
    if (pkg != lastForegroundPkg) {
      emitAppForeground(pkg)
    }

    // ── 系统级健康提醒（保留原能力，分类改用统一 AppCategories）──
    when (AppCategories.classify(pkg)) {
      AppCategories.CATEGORY_STUDY -> {
        consecutiveStudyMin += 1
        if (consecutiveStudyMin >= 90 && consecutiveStudyMin % 30 == 0) {
          notifyCare("连续学习 ${consecutiveStudyMin} 分钟了，喝水动动吧～")
        }
      }
      AppCategories.CATEGORY_ENTERTAINMENT, AppCategories.CATEGORY_SOCIAL -> {
        consecutiveStudyMin = 0
        // 深夜（23-5）正在用娱乐/社交类
        if (hour >= 23 || hour < 5) {
          notifyCare("深夜了，建议放下手机休息 5 分钟。")
          triggerLockScreen(5)
        }
        // 晚间（17-22）娱乐类累计超 1 小时
        if (hour in 17..22) {
          var totalMs = 0L
          for ((pkgKey, _) in stats) {
            if (AppCategories.isDistraction(pkgKey)) {
              totalMs += stats[pkgKey]?.totalTimeInForeground ?: 0L
            }
          }
          if (totalMs > 60 * 60 * 1000L) {
            notifyCare("今日娱乐时长已超 1 小时，监督人格注意到了。")
          }
        }
      }
      else -> {
        consecutiveStudyMin = 0
      }
    }
    lastForegroundPkg = pkg
  }

  /** 产 APP_FOREGROUND BehaviorEvent 发给 TS（携带统一分类结果） */
  private fun emitAppForeground(pkg: String) {
    try {
      val plugin = SelfDisciplinePlugin.instance ?: return
      val obj = JSObject()
      obj.put("type", "APP_FOREGROUND")
      obj.put("ts", System.currentTimeMillis())
      obj.put("packageName", pkg)
      obj.put("appCategory", AppCategories.classify(pkg))
      // 附带当前 Mission 上下文（若有），便于 TS 侧判断是否需要干预
      obj.put("hasActiveMission", MissionMirror.hasActiveMission(this))
      plugin.emitBehaviorEvent(obj)
      Log.d(TAG, "emit APP_FOREGROUND pkg=$pkg category=${AppCategories.classify(pkg)}")
    } catch (e: Exception) {
      Log.w(TAG, "emitAppForeground failed", e)
    }
  }

  private fun notifyCare(text: String) {
    val mgr = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
    val notif = Notification.Builder(this, CHANNEL_CARE)
      .setContentTitle("AI 监工 · 情绪关怀")
      .setContentText(text)
      .setSmallIcon(android.R.drawable.ic_dialog_info)
      .setAutoCancel(true)
      .setPriority(Notification.PRIORITY_HIGH)
      .build()
    mgr.notify((System.currentTimeMillis() % 10000).toInt() + 100, notif)
  }

  private fun triggerLockScreen(minutes: Int) {
    val intent = Intent(this, LockScreenActivity::class.java).apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      putExtra(LockScreenActivity.EXTRA_DURATION_SEC, minutes * 60L)
      putExtra(LockScreenActivity.EXTRA_TEXT, "${minutes} 分钟强制休息")
    }
    startActivity(intent)
  }

  private fun createChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val nm = getSystemService(NotificationManager::class.java)
      val ch1 = NotificationChannel(CHANNEL_ID, "监工前台服务", NotificationManager.IMPORTANCE_LOW)
      val ch2 = NotificationChannel(CHANNEL_CARE, "情绪关怀提醒", NotificationManager.IMPORTANCE_HIGH).apply {
        enableVibration(true); enableLights(true)
      }
      nm.createNotificationChannel(ch1)
      nm.createNotificationChannel(ch2)
    }
  }

  companion object {
    private const val CHANNEL_ID = "self_discipline_foreground"
    private const val CHANNEL_CARE = "self_discipline_care"
    private const val NOTIF_ID = 9001
  }
}
