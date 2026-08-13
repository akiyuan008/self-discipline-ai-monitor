package cn.selfdiscipline.app.plugin

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONObject

/**
 * Mission 最小运行时镜像（最终决策 #5）。
 *
 * Android 只保存最小状态镜像（missionId/status/plannedStart/plannedEnd/interventionLevel），
 * 供 MonitorService 重启后知道"当前是否有 Mission 正在执行"。
 * 业务状态的 Source of Truth 是 TypeScript persist；这里只是双保险。
 * Android 不在此实现 MissionEvaluator / RewardEngine。
 */
object MissionMirror {
  private const val PREFS_NAME = "self_discipline_mirror"
  private const val KEY_MIRROR = "mission_mirror"

  private fun prefs(ctx: Context): SharedPreferences =
    ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  /** TS 侧 syncMissionMirror 调用：保存镜像 JSON（空串视为清除） */
  fun save(ctx: Context, mirrorJson: String) {
    if (mirrorJson.isBlank()) {
      clear(ctx)
      return
    }
    prefs(ctx).edit().putString(KEY_MIRROR, mirrorJson).apply()
  }

  /** 读取原始镜像 JSON */
  fun loadRaw(ctx: Context): String? =
    prefs(ctx).getString(KEY_MIRROR, null)?.takeIf { it.isNotBlank() }

  fun clear(ctx: Context) {
    prefs(ctx).edit().remove(KEY_MIRROR).apply()
  }

  /** 当前是否存在"激活中"的 Mission（FOCUSING/DISTRACTED/INTERVENTION/RECOVERING/READY） */
  fun hasActiveMission(ctx: Context): Boolean {
    val raw = loadRaw(ctx) ?: return false
    return try {
      val status = JSONObject(raw).optString("status", "")
      status in setOf("READY", "FOCUSING", "DISTRACTED", "INTERVENTION", "RECOVERING")
    } catch (e: Exception) {
      false
    }
  }

  /** 读取干预等级（缺失返回 0） */
  fun interventionLevel(ctx: Context): Int {
    val raw = loadRaw(ctx) ?: return 0
    return try {
      JSONObject(raw).optInt("interventionLevel", 0)
    } catch (e: Exception) {
      0
    }
  }
}
