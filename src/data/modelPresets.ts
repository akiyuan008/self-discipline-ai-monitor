// 国内主流大模型 API 预设（OpenAI 兼容协议）
export interface ModelPreset {
  id: string
  vendor: string
  vendorEn: string
  endpoint: string
  models: { id: string; name: string; desc: string }[]
  getApiKeyUrl: string
  emoji: string
  accent: string
}

export const MODEL_PRESETS: ModelPreset[] = [
  {
    id: 'zhipu',
    vendor: '智谱 GLM',
    vendorEn: 'ZHIPU',
    endpoint: 'https://open.bigmodel.cn/api/paas/v4',
    getApiKeyUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
    emoji: '✦',
    accent: '#2454FF',
    models: [
      { id: 'glm-4-plus', name: 'GLM-4-Plus', desc: '旗舰，最强推理' },
      { id: 'glm-4-flash', name: 'GLM-4-Flash', desc: '免费，速度优先' },
      { id: 'glm-4-long', name: 'GLM-4-Long', desc: '29 万字长上下文' },
      { id: 'glm-4-air', name: 'GLM-4-Air', desc: '轻量，性价比高' },
      { id: 'glm-4-airx', name: 'GLM-4-AirX', desc: '极速版' }
    ]
  },
  {
    id: 'qwen',
    vendor: '通义千问',
    vendorEn: 'QWEN',
    endpoint: 'https://dashscope.aliyun.com/compatible-mode/v1',
    getApiKeyUrl: 'https://dashscope.console.aliyun.com/apiKey',
    emoji: 'Q',
    accent: '#615CED',
    models: [
      { id: 'qwen-max', name: 'Qwen-Max', desc: '旗舰，复杂任务' },
      { id: 'qwen-plus', name: 'Qwen-Plus', desc: '均衡性价比' },
      { id: 'qwen-turbo', name: 'Qwen-Turbo', desc: '极速版' },
      { id: 'qwen-long', name: 'Qwen-Long', desc: '长文档理解' }
    ]
  },
  {
    id: 'kimi',
    vendor: 'Kimi',
    vendorEn: 'MOONSHOT',
    endpoint: 'https://api.moonshot.cn/v1',
    getApiKeyUrl: 'https://platform.moonshot.cn/console/api-keys',
    emoji: '🌙',
    accent: '#000000',
    models: [
      { id: 'moonshot-v1-8k', name: 'Moonshot-v1-8k', desc: '8k 上下文' },
      { id: 'moonshot-v1-32k', name: 'Moonshot-v1-32k', desc: '32k 上下文' },
      { id: 'moonshot-v1-128k', name: 'Moonshot-v1-128k', desc: '128k 长文' },
      { id: 'kimi-latest', name: 'Kimi-Latest', desc: '最新版本' }
    ]
  },
  {
    id: 'deepseek',
    vendor: 'DeepSeek',
    vendorEn: 'DEEPSEEK',
    endpoint: 'https://api.deepseek.com/v1',
    getApiKeyUrl: 'https://platform.deepseek.com/api_keys',
    emoji: '🐋',
    accent: '#4D6BFE',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek-V3', desc: '通用对话，性价比高' },
      { id: 'deepseek-reasoner', name: 'DeepSeek-R1', desc: '推理增强' }
    ]
  },
  {
    id: 'doubao',
    vendor: '豆包 Doubao',
    vendorEn: 'DOUBAO',
    endpoint: 'https://ark.cn-beijing.volces.com/api/v3',
    getApiKeyUrl: 'https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey',
    emoji: '🫘',
    accent: '#00D6B9',
    models: [
      { id: 'doubao-pro-32k', name: 'Doubao-Pro-32k', desc: '旗舰 32k' },
      { id: 'doubao-pro-4k', name: 'Doubao-Pro-4k', desc: '短文本旗舰' },
      { id: 'doubao-lite-32k', name: 'Doubao-Lite-32k', desc: '轻量版' }
    ]
  },
  {
    id: 'ernie',
    vendor: '文心一言',
    vendorEn: 'ERNIE',
    endpoint: 'https://qianfan.baidubce.com/v2',
    getApiKeyUrl: 'https://console.bce.baidu.com/qianfan/ais/console/applicationConsole/application',
    emoji: 'ERN',
    accent: '#2932E1',
    models: [
      { id: 'ernie-4.0-8k', name: 'ERNIE-4.0', desc: '4.0 旗舰' },
      { id: 'ernie-3.5-8k', name: 'ERNIE-3.5', desc: '3.5 标准' },
      { id: 'ernie-tiny-8k', name: 'ERNIE-Tiny', desc: '极速轻量' }
    ]
  },
  {
    id: 'spark',
    vendor: '讯飞星火',
    vendorEn: 'SPARK',
    endpoint: 'https://spark-api-open.xf-yun.com/v1',
    getApiKeyUrl: 'https://console.xfyun.cn/services/bm4',
    emoji: '⭐',
    accent: '#0F8BFF',
    models: [
      { id: '4.0Ultra', name: 'Spark-4.0-Ultra', desc: '4.0 旗舰' },
      { id: 'generalv3.5', name: 'Spark-3.5', desc: '通用 3.5' },
      { id: 'generalv3', name: 'Spark-3.0', desc: '通用 3.0' }
    ]
  },
  {
    id: 'yi',
    vendor: '零一万物',
    vendorEn: 'YI',
    endpoint: 'https://api.lingyiwanwu.com/v1',
    getApiKeyUrl: 'https://platform.lingyiwanwu.com/apikeys',
    emoji: 'Y',
    accent: '#00B268',
    models: [
      { id: 'yi-large', name: 'Yi-Large', desc: '大参数旗舰' },
      { id: 'yi-medium', name: 'Yi-Medium', desc: '中等参数' },
      { id: 'yi-large-turbo', name: 'Yi-Large-Turbo', desc: '极速版' }
    ]
  },
  {
    id: 'minimax',
    vendor: 'MiniMax',
    vendorEn: 'MINIMAX',
    endpoint: 'https://api.minimax.chat/v1',
    getApiKeyUrl: 'https://platform.minimaxi.com/user-center/basic-information/interface-key',
    emoji: 'M',
    accent: '#FF2E4D',
    models: [
      { id: 'abab6.5s-chat', name: 'abab6.5s', desc: '6.5s 通用' },
      { id: 'abab6.5-chat', name: 'abab6.5', desc: '6.5 旗舰' }
    ]
  },
  {
    id: 'hunyuan',
    vendor: '腾讯混元',
    vendorEn: 'HUNYUAN',
    endpoint: 'https://api.hunyuan.cloud.tencent.com/v1',
    getApiKeyUrl: 'https://console.cloud.tencent.com/hunyuan/api-key',
    emoji: 'H',
    accent: '#0053E0',
    models: [
      { id: 'hunyuan-turbo', name: 'Hunyuan-Turbo', desc: '极速版' },
      { id: 'hunyuan-pro', name: 'Hunyuan-Pro', desc: 'Pro 旗舰' },
      { id: 'hunyuan-standard', name: 'Hunyuan-Standard', desc: '标准版' }
    ]
  },
  {
    id: 'custom',
    vendor: '自定义',
    vendorEn: 'CUSTOM',
    endpoint: '',
    getApiKeyUrl: '',
    emoji: '⚙',
    accent: '#8a8a8a',
    models: [
      { id: 'custom', name: '自定义接入', desc: 'OpenAI 兼容协议，自填 endpoint+model' }
    ]
  }
]
