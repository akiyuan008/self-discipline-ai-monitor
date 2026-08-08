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
import java.util.Calendar

/**
 * MonitorService
 *
 * 长期前台服务：周期性轮询 UsageStats，
 * - 检测到深夜 + 仍在用娱乐类 App → 发通知 + 启动锁屏遮罩
 * - 检测到连续学习超 90 分钟 → 弹情绪关怀通知
 * - 连续低分日 → 触发"深度谈话"模式（通过 WebView 调用 AI 接口，此处简化为通知）
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

    // 学习类 App：检测连续学习超 90 分钟
    if (STUDY_PACKAGES.contains(pkg)) {
      consecutiveStudyMin += 1
      if (consecutiveStudyMin >= 90 && consecutiveStudyMin % 30 == 0) {
        notifyCare("连续学习 ${consecutiveStudyMin} 分钟了，喝水动动吧～")
      }
    } else if (ENTERTAINMENT_PACKAGES.contains(pkg)) {
      consecutiveStudyMin = 0
      // 深夜（23-5）正在用娱乐类
      if (hour >= 23 || hour < 5) {
        notifyCare("深夜了，建议放下手机休息 5 分钟。")
        triggerLockScreen(5)
      }
      // 周末/通勤时段（17-22）娱乐类累计超 1 小时
      if (hour in 17..22) {
        var totalMs = 0L
        for ((pkgKey, st) in stats) {
          if (ENTERTAINMENT_PACKAGES.contains(pkgKey)) {
            totalMs += st.totalTimeInForeground
          }
        }
        if (totalMs > 60 * 60 * 1000L) {
          notifyCare("今日娱乐时长已超 1 小时，监督人格注意到了。")
        }
      }
    } else {
      consecutiveStudyMin = 0
    }
    lastForegroundPkg = pkg
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

    // 真实生产环境应当从云端拉分类名单，或读 PACKAGE_NAME 列表
    private val STUDY_PACKAGES = setOf(
      "com.xiaodao.xiaodaoapp", "cn.com.moobo.kingmath", "com.duolingo",
      "com.eusoft.ting", "com.eusoft.eudic", "com.khanacademy.app",
      "mark.via.app.subwaytoefl", "com.icourse.cn"
    )
    private val ENTERTAINMENT_PACKAGES = setOf(
      "com.ss.android.ugc.aweme", "com.ss.android.article.news",
      "com.tencent.qqlive", "tv.danmaku.bili",
      "com.miHoYo.GenshinImpact", "com.tencent.tmgp.sgame",
      "com.netease.cloudmusic", "com.kuaishou.nebula"
    )
  }
}
