package cn.selfdiscipline.app

import android.os.Bundle
import android.webkit.WebView
import androidx.core.view.WindowCompat
import cn.selfdiscipline.app.plugin.LockScreenActivity
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // 全面屏 edge-to-edge：内容延伸到状态栏和导航栏下方
    WindowCompat.setDecorFitsSystemWindows(window, false)

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
