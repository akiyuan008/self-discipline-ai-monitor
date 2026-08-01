// 应用分类（包名 → 学习/娱乐）
export const STUDY_PACKAGES = new Set<string>([
  'com.xiaodao', 'cn.com.moobo', 'com.duolingo', 'com.eusoft.ting',
  'com.eusoft.eudic', 'com.khanacademy.app', 'mark.via.app.subwaytoefl',
  'com.icourse.cn', 'com.changdu', 'com.tianqgongbaoedict'
])

export const ENTERTAINMENT_PACKAGES = new Set<string>([
  'com.ss.android.ugc.aweme', 'com.ss.android.article.news',
  'com.tencent.qqlive', 'tv.danmaku.bili',
  'com.miHoYo.GenshinImpact', 'com.miHoYo', 'com.tencent.tmgp.sgame',
  'com.netease.cloudmusic', 'com.kuaishou.nebula', 'com.ss.android.ugc.live'
])

// 显示名
export const APP_LABELS: Record<string, string> = {
  'com.xiaodao': '小道背单词',
  'cn.com.moobo': '可汗数学',
  'com.duolingo': '多邻国',
  'com.eusoft.ting': '听写大师',
  'com.eusoft.eudic': '欧路词典',
  'com.khanacademy.app': 'Khan Academy',
  'mark.via.app.subwaytoefl': '小站托福',
  'com.icourse.cn': '中国大学MOOC',
  'com.ss.android.ugc.aweme': '抖音',
  'com.ss.android.article.news': '今日头条',
  'com.tencent.qqlive': '腾讯视频',
  'tv.danmaku.bili': '哔哩哔哩',
  'com.miHoYo.GenshinImpact': '原神',
  'com.miHoYo': '原神',
  'com.tencent.tmgp.sgame': '王者荣耀',
  'com.netease.cloudmusic': '网易云音乐',
  'com.kuaishou.nebula': '快手',
  'com.ss.android.ugc.live': '抖音火山版'
}
