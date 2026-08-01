// 应用分类：学习类 vs 娱乐类（mock 数据，Android 真机由 UsageStats 拉取真实包名）
export type AppCategory = 'study' | 'social' | 'game' | 'video' | 'other'

export interface AppClassification {
  packageName: string
  label: string
  category: AppCategory
  isStudy: boolean
}

export const APP_CLASSIFICATION: AppClassification[] = [
  // 学习类
  { packageName: 'com.xiaodao.xiaodaoapp', label: '小道背单词', category: 'study', isStudy: true },
  { packageName: 'cn.com.moobo.kingmath', label: '可汗数学', category: 'study', isStudy: true },
  { packageName: 'com.eusoft.ting', label: '听写大师', category: 'study', isStudy: true },
  { packageName: 'com.khanacademy.app', label: 'Khan Academy', category: 'study', isStudy: true },
  { packageName: 'com.duolingo', label: '多邻国', category: 'study', isStudy: true },
  { packageName: 'com.eusoft.eudic', label: '欧路词典', category: 'study', isStudy: true },
  { packageName: 'mark.via.app.subwaytoefl', label: '小站托福', category: 'study', isStudy: true },
  { packageName: 'com.icourse.cn', label: '中国大学MOOC', category: 'study', isStudy: true },

  // 社交类
  { packageName: 'com.tencent.mm', label: '微信', category: 'social', isStudy: false },
  { packageName: 'com.smile.gifmaker', label: '快手', category: 'social', isStudy: false },
  { packageName: 'com.ss.android.ugc.aweme', label: '抖音', category: 'video', isStudy: false },
  { packageName: 'com.sina.weibo', label: '微博', category: 'social', isStudy: false },
  { packageName: 'com.tencent.mobileqq', label: 'QQ', category: 'social', isStudy: false },
  { packageName: 'com.alibaba.android.rimet', label: '钉钉', category: 'social', isStudy: false },

  // 视频娱乐
  { packageName: 'com.youku.phone', label: '优酷', category: 'video', isStudy: false },
  { packageName: 'com.qiyi.video', label: '爱奇艺', category: 'video', isStudy: false },
  { packageName: 'tv.danmaku.bili', label: '哔哩哔哩', category: 'video', isStudy: false },
  { packageName: 'com.netease.cloudmusic', label: '网易云音乐', category: 'video', isStudy: false },

  // 游戏
  { packageName: 'com.tencent.tmgp.pubgmhd', label: '和平精英', category: 'game', isStudy: false },
  { packageName: 'com.miHoYo.YuanShen', label: '原神', category: 'game', isStudy: false },
  { packageName: 'com.tencent.tmgp.sgame', label: '王者荣耀', category: 'game', isStudy: false },

  // 其他
  { packageName: 'com.android.chrome', label: 'Chrome', category: 'other', isStudy: false },
  { packageName: 'com.taobao.taobao', label: '淘宝', category: 'other', isStudy: false },
  { packageName: 'com.eg.android.AlipayGphone', label: '支付宝', category: 'other', isStudy: false }
]

export function classifyApp(packageName: string): AppClassification {
  return APP_CLASSIFICATION.find(a => a.packageName === packageName)
    ?? { packageName, label: packageName.split('.').pop() ?? '未知', category: 'other', isStudy: false }
}

export const CATEGORY_META: Record<AppCategory, { label: string; color: string; emoji: string }> = {
  study: { label: '学习', color: '#16a34a', emoji: '📖' },
  social: { label: '社交', color: '#2454FF', emoji: '💬' },
  video: { label: '影音', color: '#F43F5E', emoji: '🎬' },
  game: { label: '游戏', color: '#8b5cf6', emoji: '🎮' },
  other: { label: '其他', color: '#838A95', emoji: '🧩' }
}
