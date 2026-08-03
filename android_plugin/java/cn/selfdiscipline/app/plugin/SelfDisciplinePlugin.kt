package cn.selfdiscipline.app.plugin

import android.content.ActivityNotFoundException
import android.Manifest
import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.util.Log
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONArray
import java.util.Calendar

/**
 * SelfDisciplinePlugin
 *
 * 通过 @CapacitorPlugin 自动注册到 Capacitor bridge，
 * 前端 window.SelfDiscipline 调用映射到 @PluginMethod。
 *
 * 功能：
 * - getUsageStats: 通过 UsageStatsManager 拉取指定时间段的应用使用时长
 * - hasUsageAccess: 检查是否已授权 PACKAGE_USAGE_STATS（双重检测）
 * - openUsageAccessSettings: 跳到系统设置页申请权限
 * - lockScreen: 通过 PowerManager 强制锁屏 / 遮罩
 */
@CapacitorPlugin(name = "SelfDiscipline")
class SelfDisciplinePlugin : Plugin() {

  private val TAG = "SelfDiscipline"

  // -------------------------------------------------------------------
  // 使用情况权限
  // -------------------------------------------------------------------
  @PluginMethod
  fun hasUsageAccess(call: PluginCall) {
    val granted = checkUsageStatsPermission()
    val ret = JSObject()
    ret.put("granted", granted)
    call.resolve(ret)
  }

  @PluginMethod
  fun openUsageAccessSettings(call: PluginCall) {
    try {
      val act = bridge.activity ?: run {
        call.reject("Activity 不可用")
        return
      }
      // 优先跳转到「使用情况访问权限」设置页
      val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      act.startActivity(intent)
      call.resolve()
    } catch (e: ActivityNotFoundException) {
      // 某些 ROM 不支持 ACTION_USAGE_ACCESS_SETTINGS，回退到应用详情页
      Log.w(TAG, "ACTION_USAGE_ACCESS_SETTINGS not found, fallback to app details", e)
      try {
        val act = bridge.activity ?: run {
          call.reject("Activity 不可用")
          return
        }
        val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
          data = Uri.parse("package:${context.packageName}")
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        act.startActivity(intent)
        call.resolve()
      } catch (e2: Exception) {
        Log.e(TAG, "fallback settings also failed", e2)
        call.reject("无法打开设置页面：${e2.message}")
      }
    } catch (e: Exception) {
      Log.e(TAG, "openUsageAccessSettings failed", e)
      call.reject("无法打开使用情况访问设置：${e.message}")
    }
  }

  // -------------------------------------------------------------------
  // 使用统计
  // -------------------------------------------------------------------
  @PluginMethod
  fun getUsageStats(call: PluginCall) {
    val startTs = call.getLong("startTs") ?: run {
      // 默认查今天 0 点到当前
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
        // label 在前端再做映射；也可以用 PackageManager 取应用名
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

  // -------------------------------------------------------------------
  // 锁屏 / 强制休息
  // -------------------------------------------------------------------
  @PluginMethod
  fun lockScreen(call: PluginCall) {
    val minutes = call.getInt("minutes") ?: 5
    val secs = minutes * 60L

    // 方案 1：直接走 PowerManager 的 goSleep（仅系统应用可用）
    // 方案 2：启动 LockScreenActivity 全屏遮罩，到时间自动关闭
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

  // -------------------------------------------------------------------
  // 权限检测：双重检测
  // 1. AppOpsManager 检测
  // 2. 尝试直接查询 UsageStats，如果能查到数据就说明有权限
  // -------------------------------------------------------------------
  private fun checkUsageStatsPermission(): Boolean {
    // 方法1：AppOpsManager
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
    if (mode == AppOpsManager.MODE_ALLOWED) {
      return true
    }

    // 方法2：fallback - 尝试直接查询 UsageStats
    // 某些 ROM（如小米、华为）AppOpsManager 返回 MODE_DEFAULT 而不是 MODE_ALLOWED
    // 但实际上权限已经授予了
    try {
      val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      val end = System.currentTimeMillis()
      val start = end - 60_000 // 查最近1分钟
      val stats = usm.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, start, end)
      if (stats != null && stats.isNotEmpty()) {
        Log.d(TAG, "AppOps returned $mode but UsageStats query succeeded, treating as granted")
        return true
      }
    } catch (e: Exception) {
      Log.d(TAG, "UsageStats fallback query failed: ${e.message}")
    }

    return false
  }
}
