// 国内主流大模型 API 预设（OpenAI 兼容协议，2026 年最新）
export interface ModelPreset {
  id: string
  vendor: string
  vendorEn: string
  endpoint: string
  models: { id: string; name: string; desc: string; tags?: string[] }[]
  getApiKeyUrl: string
  logoText: string
  accent: string
  featured?: boolean
  tagline: string
}

export const MODEL_PRESETS: ModelPreset[] = [
  {
    id: 'zhipu',
    vendor: '智谱 GLM',
    vendorEn: 'ZHIPU',
    tagline: '清华系，国产推理旗舰',
    endpoint: 'https://open.bigmodel.cn/api/paas/v4',
    getApiKeyUrl: 'https://bigmodel.cn/usercenter/apikeys',
    logoText: 'GLM',
    accent: '#2563EB',
    featured: true,
    models: [
      { id: 'glm-4.5', name: 'GLM-4.5', desc: '最新旗舰，推理/代码/Agent', tags: ['推荐', '推理'] },
      { id: 'glm-4.5-flash', name: 'GLM-4.5-Flash', desc: '免费 + 深度思考模式', tags: ['免费'] },
      { id: 'glm-4-flash-250414', name: 'GLM-4-Flash', desc: '免费，长上下文', tags: ['免费'] },
      { id: 'glm-4-plus', name: 'GLM-4-Plus', desc: '上一代旗舰，稳定可靠' },
      { id: 'glm-4-long', name: 'GLM-4-Long', desc: '29 万字超长上下文', tags: ['长上下文'] }
    ]
  },
  {
    id: 'qwen',
    vendor: '通义千问',
    vendorEn: 'QWEN',
    tagline: '阿里云百炼，国产开源之光',
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    getApiKeyUrl: 'https://bailian.console.aliyun.com/?apiKey=1',
    logoText: '千问',
    accent: '#615CED',
    featured: true,
    models: [
      { id: 'qwen3.7-max', name: 'Qwen3.7-Max', desc: '新一代旗舰，面向智能体', tags: ['推荐', '新'] },
      { id: 'qwen3.7-plus', name: 'Qwen3.7-Plus', desc: '性价比之选，推理强' },
      { id: 'qwen3.7-flash', name: 'Qwen3.7-Flash', desc: '极速版，免费可用', tags: ['免费'] },
      { id: 'qwen-plus', name: 'Qwen-Plus', desc: '经典稳定版' },
      { id: 'qwen-turbo', name: 'Qwen-Turbo', desc: '极速版，速度快' },
      { id: 'qwen-long', name: 'Qwen-Long', desc: '千万字上下文', tags: ['长上下文'] }
    ]
  },
  {
    id: 'deepseek',
    vendor: 'DeepSeek',
    vendorEn: 'DEEPSEEK',
    tagline: '幻方量化，开源推理王者',
    endpoint: 'https://api.deepseek.com/v1',
    getApiKeyUrl: 'https://platform.deepseek.com/api_keys',
    logoText: 'DS',
    accent: '#4D6BFE',
    featured: true,
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek-V3.2', desc: '通用旗舰，对话首选', tags: ['推荐'] },
      { id: 'deepseek-reasoner', name: 'DeepSeek-R1', desc: '推理专用，对标 o1', tags: ['推理'] }
    ]
  },
  {
    id: 'kimi',
    vendor: 'Kimi',
    vendorEn: 'MOONSHOT',
    tagline: '月之暗面，长上下文鼻祖',
    endpoint: 'https://api.moonshot.cn/v1',
    getApiKeyUrl: 'https://platform.moonshot.cn/console/api-keys',
    logoText: 'Kimi',
    accent: '#000000',
    featured: true,
    models: [
      { id: 'kimi-k3', name: 'Kimi K3', desc: '最新旗舰，推理+对话', tags: ['推荐', '新'] },
      { id: 'moonshot-v1-128k', name: 'Moonshot v1 128k', desc: '12.8 万字上下文', tags: ['长上下文'] },
      { id: 'moonshot-v1-32k', name: 'Moonshot v1 32k', desc: '3.2 万字上下文' },
      { id: 'moonshot-v1-8k', name: 'Moonshot v1 8k', desc: '8 千字，最便宜' }
    ]
  },
  {
    id: 'doubao',
    vendor: '豆包',
    vendorEn: 'VOLCENGINE',
    tagline: '字节火山，每日千亿 tokens 实战',
    endpoint: 'https://ark.cn-beijing.volces.com/api/v3',
    getApiKeyUrl: 'https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey',
    logoText: '豆包',
    accent: '#FF2E4D',
    models: [
      { id: 'doubao-seed-1-6-pro-32k-250815', name: 'Doubao Seed 1.6 Pro', desc: '最新 Pro 旗舰 32k', tags: ['推荐'] },
      { id: 'doubao-1-5-pro-32k-250115', name: 'Doubao 1.5 Pro 32k', desc: '上一代 Pro' },
      { id: 'doubao-1-5-lite-32k-250115', name: 'Doubao 1.5 Lite 32k', desc: '轻量极速版', tags: ['免费'] },
      { id: 'doubao-pro-32k', name: 'Doubao Pro 32k', desc: '经典 Pro 版' }
    ]
  },
  {
    id: 'ernie',
    vendor: '文心',
    vendorEn: 'BAIDU',
    tagline: '百度千帆，国产老牌',
    endpoint: 'https://qianfan.baidubce.com/v2',
    getApiKeyUrl: 'https://console.bce.baidu.com/qianfan/ais/console/applicationConsole/list',
    logoText: '文心',
    accent: '#2932E1',
    models: [
      { id: 'ernie-5.1', name: 'ERNIE 5.1', desc: '最新旗舰模型', tags: ['推荐', '新'] },
      { id: 'ernie-4.0-8k-latest', name: 'ERNIE 4.0', desc: '4.0 旗舰 8k' },
      { id: 'ernie-3.5-8k', name: 'ERNIE 3.5', desc: '3.5 通用' },
      { id: 'ernie-speed-128k', name: 'ERNIE Speed 128k', desc: '免费，长上下文', tags: ['免费'] }
    ]
  },
  {
    id: 'spark',
    vendor: '星火',
    vendorEn: 'IFLYTEK',
    tagline: '科大讯飞，教育场景强',
    endpoint: 'https://spark-api-open.xf-yun.com/v1',
    getApiKeyUrl: 'https://console.xfyun.cn/services/bm4',
    logoText: '星火',
    accent: '#E1251B',
    models: [
      { id: '4.0Ultra', name: 'Spark 4.0 Ultra', desc: '4.0 旗舰', tags: ['推荐'] },
      { id: 'generalv3.5', name: 'Spark 3.5', desc: '3.5 通用' },
      { id: 'general', name: 'Spark Lite', desc: '免费', tags: ['免费'] }
    ]
  },
  {
    id: 'yi',
    vendor: 'Yi',
    vendorEn: 'LINGYI',
    tagline: '零一万物，李开复创办',
    endpoint: 'https://api.lingyiwanwu.com/v1',
    getApiKeyUrl: 'https://platform.lingyiwanwu.com/apikeys',
    logoText: 'Yi',
    accent: '#003D82',
    models: [
      { id: 'yi-large', name: 'Yi-Large', desc: '旗舰模型', tags: ['推荐'] },
      { id: 'yi-large-turbo', name: 'Yi-Large-Turbo', desc: '极速版' },
      { id: 'yi-medium', name: 'Yi-Medium', desc: '中等规模' }
    ]
  },
  {
    id: 'minimax',
    vendor: 'MiniMax',
    vendorEn: 'MINIMAX',
    tagline: '联汇，长上下文 + 多模态',
    endpoint: 'https://api.minimax.chat/v1',
    getApiKeyUrl: 'https://platform.minimaxi.com/user-center/basic-information/interface-key',
    logoText: 'M',
    accent: '#FF2E4D',
    models: [
      { id: 'MiniMax-Text-01', name: 'MiniMax-Text-01', desc: '最新旗舰模型', tags: ['推荐', '新'] },
      { id: 'abab6.5s-chat', name: 'abab6.5s', desc: '6.5s 通用版' },
      { id: 'abab6.5-chat', name: 'abab6.5', desc: '6.5 旗舰' }
    ]
  },
  {
    id: 'hunyuan',
    vendor: '混元',
    vendorEn: 'TENCENT',
    tagline: '腾讯，OpenAI SDK 兼容',
    endpoint: 'https://api.hunyuan.cloud.tencent.com/v1',
    getApiKeyUrl: 'https://console.cloud.tencent.com/hunyuan/api-key',
    logoText: '混',
    accent: '#0053E0',
    models: [
      { id: 'hunyuan-turbo', name: 'Hunyuan-Turbo', desc: '极速版', tags: ['推荐'] },
      { id: 'hunyuan-pro', name: 'Hunyuan-Pro', desc: 'Pro 旗舰' },
      { id: 'hunyuan-standard', name: 'Hunyuan-Standard', desc: '标准版' }
    ]
  },
  {
    id: 'custom',
    vendor: '自定义',
    vendorEn: 'CUSTOM',
    tagline: 'OpenAI 兼容协议，任意接入',
    endpoint: '',
    getApiKeyUrl: '',
    logoText: '⚙',
    accent: '#8a8a8a',
    models: [
      { id: 'custom', name: '自定义接入', desc: '自填 endpoint + model' }
    ]
  }
]
