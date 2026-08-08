package cn.selfdiscipline.app.plugin

import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
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

    // 判断权限：模式为 ALLOWED，或者 fallback 方式实际获取到数据
    val granted = (mode == AppOpsManager.MODE_ALLOWED) || checkUsageStatsFallback()
    Log.d(TAG, "hasUsageAccess result: granted=$granted")

    val ret = JSObject()
    ret.put("granted", granted)
    ret.put("mode", mode)
    call.resolve(ret)
  }

  @PluginMethod
  fun openUsageAccessSettings(call: PluginCall) {
    Log.d(TAG, "openUsageAccessSettings called")
    // 方式1: 用 Activity 上下文直接打开（最可靠）
    try {
      val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
      activity.startActivity(intent)
      Log.d(TAG, "Opened USAGE_ACCESS via activity")
      call.resolve()
      return
    } catch (e: Exception) {
      Log.w(TAG, "activity intent failed", e)
    }
    // 方式2: application context + NEW_TASK
    try {
      val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      context.startActivity(intent)
      Log.d(TAG, "Opened USAGE_ACCESS via context+NEW_TASK")
      call.resolve()
      return
    } catch (e: Exception) {
      Log.w(TAG, "context intent failed", e)
    }
    // 方式3: 降级到应用详情页
    try {
      val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
        data = android.net.Uri.parse("package:${context.packageName}")
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      context.startActivity(intent)
      Log.d(TAG, "Opened APP_DETAILS as fallback")
      call.resolve()
    } catch (e: Exception) {
      Log.e(TAG, "All settings intents failed", e)
      call.reject("无法打开设置页面：${e.message}")
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
    val hasPermission = (mode == AppOpsManager.MODE_ALLOWED) || checkUsageStatsFallback()

    if (!hasPermission) {
      call.reject("缺少使用情况访问权限")
      return
    }

    try {
      val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      val aggregatedMap = usm.queryAndAggregateUsageStats(startTs, endTs)
      val arr = JSArray()

      if (!aggregatedMap.isNullOrEmpty()) {
        for ((pkgName, s) in aggregatedMap) {
          if (s.totalTimeInForeground > 0) {
            val obj = JSObject()
            obj.put("packageName", pkgName)
            obj.put("totalMs", s.totalTimeInForeground)
            obj.put("foregroundMs", s.totalTimeInForeground)
            obj.put("lastTimeUsed", s.lastTimeUsed)
            obj.put("firstTimeUsed", s.firstTimeStamp)
            obj.put("label", getAppLabel(pkgName))
            arr.put(obj)
          }
        }
      } else {
        val rawStats = usm.queryUsageStats(
          UsageStatsManager.INTERVAL_DAILY,
          startTs,
          endTs
        ) ?: emptyList()
        for (s in rawStats) {
          if (s.totalTimeInForeground > 0) {
            val obj = JSObject()
            obj.put("packageName", s.packageName)
            obj.put("totalMs", s.totalTimeInForeground)
            obj.put("foregroundMs", s.totalTimeInForeground)
            obj.put("lastTimeUsed", s.lastTimeUsed)
            obj.put("firstTimeUsed", s.firstTimeStamp)
            obj.put("label", getAppLabel(s.packageName))
            arr.put(obj)
          }
        }
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
   * 通过 PackageManager 获取应用显示名称
   */
  private fun getAppLabel(pkg: String): String {
    return try {
      val pm = context.packageManager
      val appInfo = pm.getApplicationInfo(pkg, 0)
      pm.getApplicationLabel(appInfo).toString()
    } catch (e: PackageManager.NameNotFoundException) {
      pkg.substringAfterLast('.')
    }
  }

  /**
   * 启动监工前台服务
   */
  @PluginMethod
  fun startMonitorService(call: PluginCall) {
    try {
      val intent = Intent(context, MonitorService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
      Log.d(TAG, "MonitorService started")
      call.resolve()
    } catch (e: Exception) {
      Log.e(TAG, "startMonitorService failed", e)
      call.reject("启动监工服务失败：${e.message}")
    }
  }

  /**
   * 停止监工前台服务
   */
  @PluginMethod
  fun stopMonitorService(call: PluginCall) {
    try {
      val intent = Intent(context, MonitorService::class.java)
      context.stopService(intent)
      Log.d(TAG, "MonitorService stopped")
      call.resolve()
    } catch (e: Exception) {
      Log.e(TAG, "stopMonitorService failed", e)
      call.reject("停止监工服务失败：${e.message}")
    }
  }

  /**
   * Fallback：尝试查询 UsageStats，能查且有数据或无异常说明有权限
   */
  private fun checkUsageStatsFallback(): Boolean {
    return try {
      val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      val end = System.currentTimeMillis()
      val start = end - 24 * 60 * 60 * 1000
      val stats = usm.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, start, end)
      !stats.isNullOrEmpty()
    } catch (e: Exception) {
      false
    }
  }
}
