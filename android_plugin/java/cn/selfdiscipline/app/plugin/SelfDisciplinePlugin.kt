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

/**
 * SelfDisciplinePlugin - 赛博监工原生插件
 *
 * 参考实现：com.cyber.monitor.data.monitor.UsageStatsHelper
 * 权限检测只用 AppOpsManager.checkOpNoThrow()，标准可靠。
 * 查询使用统计只用 queryUsageStats(INTERVAL_DAILY) 并自行过滤。
 */
@CapacitorPlugin(name = "SelfDiscipline")
class SelfDisciplinePlugin : Plugin() {

  private val TAG = "SelfDiscipline"

  // -----------------------------------------------------------------
  // 权限检测
  // -----------------------------------------------------------------
  @PluginMethod
  fun hasUsageAccess(call: PluginCall) {
    val granted = hasUsageStatsPermission(context)
    Log.d(TAG, "hasUsageAccess: granted=$granted")
    val ret = JSObject()
    ret.put("granted", granted)
    call.resolve(ret)
  }

  // -----------------------------------------------------------------
  // 跳转权限设置页
  // -----------------------------------------------------------------
  @PluginMethod
  fun openUsageAccessSettings(call: PluginCall) {
    Log.d(TAG, "openUsageAccessSettings called")
    try {
      val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      context.startActivity(intent)
      Log.d(TAG, "Started ACTION_USAGE_ACCESS_SETTINGS")
      call.resolve()
    } catch (e: Exception) {
      Log.e(TAG, "Failed to open usage access settings", e)
      call.reject("无法打开设置页面：${e.message}")
    }
  }

  // -----------------------------------------------------------------
  // 查询使用统计
  // -----------------------------------------------------------------
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

    if (!hasUsageStatsPermission(context)) {
      call.reject("缺少使用情况访问权限")
      return
    }

    try {
      val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager

      // 关键：使用 INTERVAL_DAILY 查询，再在结果中按时间过滤
      val rawStats = usm.queryUsageStats(
        UsageStatsManager.INTERVAL_DAILY,
        startTs,
        endTs
      ) ?: emptyList()

      // 过滤：仅保留 lastTimeUsed 在时间窗口内且前台时间 > 0
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

  // -----------------------------------------------------------------
  // 锁屏
  // -----------------------------------------------------------------
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

  // -----------------------------------------------------------------
  // 权限检测实现（参考 UsageStatsHelper.hasUsageStatsPermission）
  // -----------------------------------------------------------------
  private fun hasUsageStatsPermission(context: Context): Boolean {
    val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    @Suppress("DEPRECATION")
    val mode = appOps.checkOpNoThrow(
      AppOpsManager.OPSTR_GET_USAGE_STATS,
      android.os.Process.myUid(),
      context.packageName
    )
    return mode == AppOpsManager.MODE_ALLOWED
  }
}
