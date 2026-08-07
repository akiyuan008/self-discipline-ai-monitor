package cn.selfdiscipline.app.plugin

import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.util.Log
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.util.Calendar

@CapacitorPlugin(name = "SelfDiscipline")
class SelfDisciplinePlugin : Plugin() {

  private val TAG = "SelfDiscipline"

  @PluginMethod
  fun hasUsageAccess(call: PluginCall) {
    val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    @Suppress("DEPRECATION")
    val mode = appOps.checkOpNoThrow(
      AppOpsManager.OPSTR_GET_USAGE_STATS,
      android.os.Process.myUid(),
      context.packageName
    )
    Log.d(TAG, "hasUsageAccess: mode=$mode (ALLOWED=${AppOpsManager.MODE_ALLOWED}, DEFAULT=${AppOpsManager.MODE_DEFAULT})")

    // 某些 ROM 返回 MODE_DEFAULT 但实际有权限，尝试 fallback
    var granted = mode == AppOpsManager.MODE_ALLOWED
    if (!granted && mode == AppOpsManager.MODE_DEFAULT) {
      granted = checkUsageStatsFallback()
      Log.d(TAG, "hasUsageAccess: fallback check = $granted")
    }

    val ret = JSObject()
    ret.put("granted", granted)
    ret.put("mode", mode)
    call.resolve(ret)
  }

  @PluginMethod
  fun openUsageAccessSettings(call: PluginCall) {
    Log.d(TAG, "openUsageAccessSettings called")
    try {
      // 使用 activity（不是 context）启动，不需要 NEW_TASK
      val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
      activity.startActivity(intent)
      Log.d(TAG, "Started ACTION_USAGE_ACCESS_SETTINGS via activity")
      call.resolve()
    } catch (e: Exception) {
      Log.e(TAG, "Failed to open usage access settings", e)
      // fallback: 应用详情页
      try {
        val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
          data = android.net.Uri.parse("package:${activity.packageName}")
        }
        activity.startActivity(intent)
        Log.d(TAG, "Started APPLICATION_DETAILS_SETTINGS fallback")
        call.resolve()
      } catch (e2: Exception) {
        Log.e(TAG, "Fallback also failed", e2)
        call.reject("无法打开设置页面：${e2.message}")
      }
    }
  }

  @PluginMethod
  fun getUsageStats(call: PluginCall) {
    val startTs = call.getLong("startTs") ?: run {
      val cal = Calendar.getInstance().apply {
        set(Calendar.HOUR_OF_DAY, 0)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
      }
      cal.timeInMillis
    }
    val endTs = call.getLong("endTs") ?: System.currentTimeMillis()

    val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    @Suppress("DEPRECATION")
    val mode = appOps.checkOpNoThrow(
      AppOpsManager.OPSTR_GET_USAGE_STATS,
      android.os.Process.myUid(),
      context.packageName
    )
    var hasPermission = mode == AppOpsManager.MODE_ALLOWED
    if (!hasPermission && mode == AppOpsManager.MODE_DEFAULT) {
      hasPermission = checkUsageStatsFallback()
    }

    if (!hasPermission) {
      call.reject("缺少使用情况访问权限")
      return
    }

    try {
      val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      val rawStats = usm.queryUsageStats(
        UsageStatsManager.INTERVAL_DAILY,
        startTs,
        endTs
      ) ?: emptyList()

      val filtered = rawStats.filter {
        it.lastTimeUsed in startTs..endTs && it.totalTimeInForeground > 0
      }

      val arr = JSArray()
      for (s in filtered) {
        val obj = JSObject()
        obj.put("packageName", s.packageName)
        obj.put("totalMs", s.totalTimeInForeground)
        obj.put("foregroundMs", s.totalTimeInForeground)
        obj.put("lastTimeUsed", s.lastTimeUsed)
        obj.put("firstTimeUsed", s.firstTimeStamp)
        arr.put(obj)
      }

      val ret = JSObject()
      ret.put("stats", arr)
      call.resolve(ret)
    } catch (e: Exception) {
      Log.e(TAG, "getUsageStats failed", e)
      call.reject("查询使用统计失败：${e.message}")
    }
  }

  @PluginMethod
  fun lockScreen(call: PluginCall) {
    val minutes = call.getInt("minutes") ?: 5
    val secs = minutes * 60L
    try {
      val intent = Intent(context, LockScreenActivity::class.java).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        putExtra(LockScreenActivity.EXTRA_DURATION_SEC, secs)
        putExtra(LockScreenActivity.EXTRA_TEXT,
          call.getString("text") ?: "休息一下，${minutes} 分钟后解锁")
      }
      context.startActivity(intent)
      call.resolve()
    } catch (e: Exception) {
      Log.e(TAG, "lockScreen failed", e)
      call.reject("锁屏失败：${e.message}")
    }
  }

  @PluginMethod
  fun showOverlay(call: PluginCall) {
    val text = call.getString("text") ?: "放下手机，先专注眼前"
    try {
      val intent = Intent(context, LockScreenActivity::class.java).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        putExtra(LockScreenActivity.EXTRA_DURATION_SEC, 30L)
        putExtra(LockScreenActivity.EXTRA_TEXT, text)
      }
      context.startActivity(intent)
      call.resolve()
    } catch (e: Exception) {
      call.reject("遮罩失败：${e.message}")
    }
  }

  /**
   * Fallback：尝试查询 UsageStats，能查就说明有权限
   */
  private fun checkUsageStatsFallback(): Boolean {
    return try {
      val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      val end = System.currentTimeMillis()
      val start = end - 24 * 60 * 60 * 1000
      val stats = usm.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, start, end)
      stats.isNotEmpty()
    } catch (e: Exception) {
      false
    }
  }
}
