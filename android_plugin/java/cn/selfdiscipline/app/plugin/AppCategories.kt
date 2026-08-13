package cn.selfdiscipline.app.plugin

/**
 * AUTO-GENERATED from config/appCategories.json — DO NOT EDIT.
 * Regenerate with: npm run gen:android-categories
 *
 * App 分类唯一数据源（Single Source of Truth），与 TypeScript 共用同一份配置。
 * Android 在构建时消费 config/appCategories.json 生成本文件，不维护独立分类。
 */
object AppCategories {
  const val CATEGORY_STUDY = "study"
  const val CATEGORY_ENTERTAINMENT = "entertainment"
  const val CATEGORY_SOCIAL = "social"
  const val CATEGORY_NEUTRAL = "neutral"

  val STUDY_PACKAGES: Set<String> = setOf(
      "com.xiaodao",
      "com.xiaodao.xiaodaoapp",
      "cn.com.moobo",
      "cn.com.moobo.kingmath",
      "com.duolingo",
      "com.eusoft.ting",
      "com.eusoft.eudic",
      "com.khanacademy.app",
      "mark.via.app.subwaytoefl",
      "com.icourse.cn",
      "com.changdu",
      "com.tianqgongbaoedict",
      "com.fenbi.android.zhaokao",
      "com.yuanfudao.tutor",
      "com.zuoyebang.knowledge",
      "com.youdao.dict",
      "com.baidu.baike"
  )

  val ENTERTAINMENT_PACKAGES: Set<String> = setOf(
      "com.ss.android.ugc.aweme",
      "com.ss.android.ugc.aweme.lite",
      "com.ss.android.article.news",
      "com.ss.android.ugc.live",
      "com.tencent.qqlive",
      "tv.danmaku.bili",
      "com.miHoYo.GenshinImpact",
      "com.miHoYo",
      "com.miHoYo.hkrpg",
      "com.tencent.tmgp.sgame",
      "com.netease.cloudmusic",
      "com.kuaishou.nebula",
      "com.xunmeng.pinduoduo",
      "com.taobao.taobao",
      "com.jingdong.app.mall",
      "com.zhihu.android",
      "com.sankuai.meituan",
      "com.baidu.netdisk",
      "com.sdu.didi.psngr",
      "com.alicloud.databox"
  )

  val SOCIAL_PACKAGES: Set<String> = setOf(
      "com.tencent.mm",
      "com.tencent.mobileqq",
      "com.sina.weibo"
  )

  val NEUTRAL_PACKAGES: Set<String> = setOf(
      "android",
      "com.android.systemui",
      "com.android.launcher",
      "com.android.launcher3",
      "com.android.settings",
      "com.google.android.inputmethod.latin",
      "com.sohu.inputmethod.sogou",
      "com.baidu.input",
      "com.android.phone",
      "com.android.dialer",
      "com.android.providers.telephony"
  )

  val APP_LABELS: Map<String, String> = mapOf(
      "com.xiaodao" to "小道背单词",
      "com.xiaodao.xiaodaoapp" to "小道背单词",
      "cn.com.moobo" to "可汗数学",
      "cn.com.moobo.kingmath" to "可汗数学",
      "com.duolingo" to "多邻国",
      "com.eusoft.ting" to "听写大师",
      "com.eusoft.eudic" to "欧路词典",
      "com.khanacademy.app" to "Khan Academy",
      "mark.via.app.subwaytoefl" to "小站托福",
      "com.icourse.cn" to "中国大学MOOC",
      "com.fenbi.android.zhaokao" to "粉笔",
      "com.yuanfudao.tutor" to "猿辅导",
      "com.zuoyebang.knowledge" to "作业帮",
      "com.youdao.dict" to "网易有道词典",
      "com.baidu.baike" to "百度百科",
      "com.ss.android.ugc.aweme" to "抖音",
      "com.ss.android.ugc.aweme.lite" to "抖音极速版",
      "com.ss.android.article.news" to "今日头条",
      "com.ss.android.ugc.live" to "抖音火山版",
      "com.tencent.qqlive" to "腾讯视频",
      "tv.danmaku.bili" to "哔哩哔哩",
      "com.miHoYo.GenshinImpact" to "原神",
      "com.miHoYo" to "米哈游",
      "com.miHoYo.hkrpg" to "崩坏：星穹铁道",
      "com.tencent.tmgp.sgame" to "王者荣耀",
      "com.netease.cloudmusic" to "网易云音乐",
      "com.kuaishou.nebula" to "快手极速版",
      "com.xunmeng.pinduoduo" to "拼多多",
      "com.taobao.taobao" to "淘宝",
      "com.jingdong.app.mall" to "京东",
      "com.zhihu.android" to "知乎",
      "com.tencent.mm" to "微信",
      "com.tencent.mobileqq" to "QQ",
      "com.sina.weibo" to "微博",
      "com.sankuai.meituan" to "美团",
      "com.baidu.netdisk" to "百度网盘",
      "com.sdu.didi.psngr" to "滴滴出行",
      "com.alicloud.databox" to "阿里云盘"
  )

  /** 精确分类（包名命中）；未命中归为 neutral */
  fun classify(pkg: String): String = when {
    STUDY_PACKAGES.contains(pkg) -> CATEGORY_STUDY
    ENTERTAINMENT_PACKAGES.contains(pkg) -> CATEGORY_ENTERTAINMENT
    SOCIAL_PACKAGES.contains(pkg) -> CATEGORY_SOCIAL
    NEUTRAL_PACKAGES.contains(pkg) -> CATEGORY_NEUTRAL
    else -> CATEGORY_NEUTRAL
  }

  /** 分心类 App：娱乐 + 社交 */
  fun isDistraction(pkg: String): Boolean {
    val c = classify(pkg)
    return c == CATEGORY_ENTERTAINMENT || c == CATEGORY_SOCIAL
  }

  fun label(pkg: String): String = APP_LABELS[pkg] ?: pkg.substringAfterLast('.')
}
