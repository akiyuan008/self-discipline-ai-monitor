// 应用分类（包名 → 学习/娱乐/系统）
export const STUDY_PACKAGES = new Set<string>([
  'com.xiaodao', 'com.xiaodao.xiaodaoapp', 'cn.com.moobo', 'cn.com.moobo.kingmath',
  'com.duolingo', 'com.eusoft.ting', 'com.eusoft.eudic', 'com.khanacademy.app',
  'mark.via.app.subwaytoefl', 'com.icourse.cn', 'com.changdu', 'com.tianqgongbaoedict',
  'com.fenbi.android.zhaokao', 'com.yuanfudao.tutor', 'com.zuoyebang.knowledge',
  'com.youdao.dict', 'com.baidu.baike'
])

export const ENTERTAINMENT_PACKAGES = new Set<string>([
  'com.ss.android.ugc.aweme', 'com.ss.android.article.news',
  'com.tencent.qqlive', 'tv.danmaku.bili',
  'com.miHoYo.GenshinImpact', 'com.miHoYo', 'com.miHoYo.hkrpg', 'com.tencent.tmgp.sgame',
  'com.netease.cloudmusic', 'com.kuaishou.nebula', 'com.ss.android.ugc.live',
  'com.tencent.mm', 'com.tencent.mobileqq', 'com.sina.weibo', 'com.xunmeng.pinduoduo',
  'com.taobao.taobao', 'com.jingdong.app.mall', 'com.zhihu.android',
  'com.ss.android.ugc.aweme.lite', 'com.kuaishou.nebula', 'com.sankuai.meituan',
  'com.baidu.netdisk', 'com.sdu.didi.psngr', 'com.alicloud.databox'
])

export const SYSTEM_PACKAGES = new Set<string>([
  'android', 'com.android.systemui', 'com.android.launcher', 'com.android.launcher3',
  'com.android.settings', 'com.google.android.inputmethod.latin', 'com.sohu.inputmethod.sogou',
  'com.baidu.input', 'com.android.phone', 'com.android.dialer', 'com.android.providers.telephony'
])

// 显示名
export const APP_LABELS: Record<string, string> = {
  'com.xiaodao': '小道背单词',
  'com.xiaodao.xiaodaoapp': '小道背单词',
  'cn.com.moobo': '可汗数学',
  'cn.com.moobo.kingmath': '可汗数学',
  'com.duolingo': '多邻国',
  'com.eusoft.ting': '听写大师',
  'com.eusoft.eudic': '欧路词典',
  'com.khanacademy.app': 'Khan Academy',
  'mark.via.app.subwaytoefl': '小站托福',
  'com.icourse.cn': '中国大学MOOC',
  'com.fenbi.android.zhaokao': '粉笔',
  'com.yuanfudao.tutor': '猿辅导',
  'com.zuoyebang.knowledge': '作业帮',
  'com.youdao.dict': '网易有道词典',
  'com.ss.android.ugc.aweme': '抖音',
  'com.ss.android.article.news': '今日头条',
  'com.tencent.qqlive': '腾讯视频',
  'tv.danmaku.bili': '哔哩哔哩',
  'com.miHoYo.GenshinImpact': '原神',
  'com.miHoYo': '原神',
  'com.miHoYo.hkrpg': '崩坏：星穹铁道',
  'com.tencent.tmgp.sgame': '王者荣耀',
  'com.netease.cloudmusic': '网易云音乐',
  'com.kuaishou.nebula': '快手极速版',
  'com.ss.android.ugc.live': '抖音火山版',
  'com.tencent.mm': '微信',
  'com.tencent.mobileqq': 'QQ',
  'com.sina.weibo': '微博',
  'com.xunmeng.pinduoduo': '拼多多',
  'com.taobao.taobao': '淘宝',
  'com.jingdong.app.mall': '京东',
  'com.zhihu.android': '知乎'
}

export function isStudyApp(pkg: string, label: string = ''): boolean {
  if (STUDY_PACKAGES.has(pkg)) return true
  const lowerPkg = pkg.toLowerCase()
  const lowerLabel = label.toLowerCase()
  const studyKeywords = [
    'study', 'learn', 'edu', 'dict', 'math', 'word', 'course', 'book', 'read',
    'mooc', 'toefl', 'ielts', 'exam', 'gaokao', 'tutor', 'class', 'school',
    '学习', '背词', '词典', '数学', '英语', '大学', '课堂', '刷题', '高考', '辅导'
  ]
  return studyKeywords.some(k => lowerPkg.includes(k) || lowerLabel.includes(k))
}

export function isEntertainmentApp(pkg: string, label: string = ''): boolean {
  if (ENTERTAINMENT_PACKAGES.has(pkg)) return true
  const lowerPkg = pkg.toLowerCase()
  const lowerLabel = label.toLowerCase()
  const entKeywords = [
    'game', 'video', 'tv', 'bili', 'douyin', 'tiktok', 'kuaishou', 'news',
    'music', 'stream', 'play', 'live', 'manga', 'novel', 'comic', 'shop',
    '游戏', '视频', '动漫', '小说', '音乐', '直播', '娱乐', '头条', '社交'
  ]
  return entKeywords.some(k => lowerPkg.includes(k) || lowerLabel.includes(k))
}
