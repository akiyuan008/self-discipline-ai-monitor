package cn.selfdiscipline.app

import android.os.Bundle
import cn.selfdiscipline.app.plugin.LockScreenActivity
import com.getcapacitor.BridgeActivity

/**
 * MainActivity
 * 继承 Capacitor 的 BridgeActivity，注册自定义插件 SelfDisciplinePlugin。
 *
 * 在 AndroidManifest.xml 中需要：
 * 1. 注册 LockScreenActivity
 * 2. 申请 PACKAGE_USAGE_STATS 权限
 * 3. 申请 SYSTEM_ALERT_WINDOW / FOREGROUND_SERVICE 等可选权限
 */
class MainActivity : BridgeActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // 在 super.onCreate 前注册自定义插件
    registerPlugin(cn.selfdiscipline.app.plugin.SelfDisciplinePlugin::class.java)
    super.onCreate(savedInstanceState)
  }
}
