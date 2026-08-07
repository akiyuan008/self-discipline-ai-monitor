import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'cn.selfdiscipline.app',
  appName: '自律养成 · AI监工',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: false
  },
  server: {
    androidScheme: 'https',
    cleartext: false
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: '#F4F3F0',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    },
    StatusBar: {
      style: 'LIGHT',
      overlaysWebView: true
    }
  }
}

export default config
