package cn.selfdiscipline.app

import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import androidx.core.view.WindowCompat
import cn.selfdiscipline.app.plugin.LockScreenActivity
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // ── 全面屏 edge-to-edge：内容延伸到状态栏和导航栏下方 ──
    WindowCompat.setDecorFitsSystemWindows(window, false)

    // ── 挖孔/刘海屏适配（Redmi K40 等）──
    // 不设置此项时，全面屏模式下挖孔区域会显示一条黑边。
    // SHORT_EDGES 允许内容延伸到短边挖孔区，黑边消失。
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      val lp = window.attributes
      lp.layoutInDisplayCutoutMode =
        WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
      window.attributes = lp
    }

    // 状态栏/导航栏透明，图标用深色（浅色背景）
    window.statusBarColor = android.graphics.Color.TRANSPARENT
    window.navigationBarColor = android.graphics.Color.TRANSPARENT
    WindowCompat.getInsetsController(window, window.decorView).apply {
      isAppearanceLightStatusBars = true
      isAppearanceLightNavigationBars = true
    }

    registerPlugin(cn.selfdiscipline.app.plugin.SelfDisciplinePlugin::class.java)
    super.onCreate(savedInstanceState)

    // 启用 WebView 文本选择和长按菜单（复制/剪切/粘贴）
    bridge.webView?.let { webView ->
      webView.isLongClickable = true
      webView.isFocusable = true
      webView.isFocusableInTouchMode = true
      webView.settings?.let {
        it.javaScriptEnabled = true
        it.domStorageEnabled = true
        it.builtInZoomControls = true
        it.displayZoomControls = false
      }
    }
  }
}
