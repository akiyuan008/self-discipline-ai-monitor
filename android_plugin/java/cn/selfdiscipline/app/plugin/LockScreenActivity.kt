package cn.selfdiscipline.app.plugin

import android.app.Activity
import android.os.Bundle
import android.os.CountDownTimer
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.TextView

/**
 * LockScreenActivity
 *
 * 强制锁屏遮罩：
 * - 全屏覆盖 + 禁用返回（重写 onBackPressed）
 * - 倒计时结束自动 finish()
 * - 仅靠 Activity 级别，无法阻止物理 power 锁屏，但能在重新亮屏后自动恢复
 *
 * 真正的"系统级锁屏"需要 DevicePolicyManager.lockNow()，且要 DPM 管理员权限。
 * 个人开发者通常用此 Activity 方案即可满足"强制休息"诉求。
 */
class LockScreenActivity : Activity() {

  private var timer: CountDownTimer? = null
  private val handler = Handler(Looper.getMainLooper())
  private val finishChecker = object : Runnable {
    override fun run() {
      if (isFinishing) return
      // 用户可能锁屏了手机，恢复时继续检查
      handler.postDelayed(this, 1000)
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    // 全屏沉浸式
    window.setFlags(
      WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
        WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
        WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON,
      WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
        WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
        WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
    )

    val seconds = intent.getLongExtra(EXTRA_DURATION_SEC, 300L)
    val text = intent.getStringExtra(EXTRA_TEXT) ?: "休息一下"

    val tv = TextView(this).apply {
      gravity = Gravity.CENTER
      setTextColor(0xFFFFFFFF.toInt())
      textSize = 24f
      text = text + "\n\n剩余 ${seconds / 60} 分 ${seconds % 60} 秒"
      setPadding(48, 0, 48, 0)
    }
    setContentView(tv)
    window.decorView.systemUiVisibility = (
      View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
        or View.SYSTEM_UI_FLAG_FULLSCREEN
        or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
        or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
      )

    timer = object : CountDownTimer(seconds * 1000, 1000) {
      override fun onTick(millisUntilFinished: Long) {
        val s = millisUntilFinished / 1000
        tv.text = "$text\n\n剩余 ${s / 60} 分 ${s % 60} 秒"
      }
      override fun onFinish() {
        finish()
      }
    }.start()
    handler.postDelayed(finishChecker, 1000)
  }

  @Deprecated("BackPressed")
  override fun onBackPressed() {
    // 屏蔽返回键
  }

  override fun onDestroy() {
    super.onDestroy()
    timer?.cancel()
    handler.removeCallbacks(finishChecker)
  }

  companion object {
    const val EXTRA_DURATION_SEC = "duration_sec"
    const val EXTRA_TEXT = "text"
  }
}
