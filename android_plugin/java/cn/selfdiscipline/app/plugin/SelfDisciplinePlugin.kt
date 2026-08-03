package cn.selfdiscipline.app.plugin

import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.net.Uri
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
    val granted = checkUsageStatsPermission()
    Log.d(TAG, "hasUsageAccess: granted=$granted")
    val ret = JSObject()
    ret.put("granted", granted)
    call.resolve(ret)
  }

  @PluginMethod
  fun openUsageAccessSettings(call: PluginCall) {
    Log.d(TAG, "openUsageAccessSettings called")
    val act = activity
    if (act == null) {
      Log.e(TAG, "activity is null")
      call.reject("Activity 不可用")
      return
    }

    // 直接跳转到应用详情页（所有ROM都支持）
    // 用户可以在详情页 -> 权限 -> 特殊权限 -> 使用情况访问权限 中手动开启
    try {
      val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
        data = Uri.parse("package:${act.packageName}")
      }
      act.startActivity(intent)
      Log.d(TAG, "Started APPLICATION_DETAILS_SETTINGS")
      call.resolve()
    } catch (e: Exception) {
      Log.e(TAG, "Failed to open settings", e)
      call.reject("无法打开设置页面：${e.message}")
    }
  }

  @PluginMethod
  fun getUsageStats(call: PluginCall) {
    val startTs = call.getLong("startTs") ?: run {
      val cal = Calendar.getInstance().apply {
        set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
      }
      cal.timeInMillis
    }
    val endTs = call.getLong("endTs") ?: System.currentTimeMillis()

    if (!checkUsageStatsPermission()) {
      call.reject("缺少使用情况访问权限")
      return
    }

    try {
      val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      val stats = usm.queryAndAggregateUsageStats(startTs, endTs) ?: emptyList()
      val arr = JSArray()
      for (s in stats) {
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
   * 权限检测：以能否成功查询 UsageStats 为准
   */
  private fun checkUsageStatsPermission(): Boolean {
    try {
      val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      val end = System.currentTimeMillis()
      val start = end - 24 * 60 * 60 * 1000 // 最近24小时
      val stats = usm.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, start, end)
      // 只要能查询成功（不抛异常），就说明有权限
      // 返回null在某些ROM中表示无权限，返回空列表表示有权限但无数据
      return stats != null
    } catch (e: SecurityException) {
      Log.d(TAG, "UsageStats SecurityException: ${e.message}")
      return false
    } catch (e: Exception) {
      Log.d(TAG, "UsageStats query failed: ${e.message}")
      // fallback: AppOpsManager
      return checkAppOpsPermission()
    }
  }

  private fun checkAppOpsPermission(): Boolean {
    return try {
      val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
      val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        appOps.unsafeCheckOpNoThrow(
          AppOpsManager.OPSTR_GET_USAGE_STATS,
          android.os.Process.myUid(),
          context.packageName
        )
      } else {
        @Suppress("DEPRECATION")
        appOps.checkOpNoThrow(
          AppOpsManager.OPSTR_GET_USAGE_STATS,
          android.os.Process.myUid(),
          context.packageName
        )
      }
      mode == AppOpsManager.MODE_ALLOWED
    } catch (e: Exception) {
      false
    }
  }
}
