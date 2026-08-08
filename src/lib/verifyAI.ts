import { useStore } from '@/stores/useStore'
import { buildChatUrl } from '@/lib/ai'
import { logger } from '@/lib/logger'

export interface VerifyResult {
  passed: boolean
  score: number
  review: string
  suggestion: string
}

const VERIFY_PROMPT = `你是一位严格的课程打卡验证官（二号AI）。

你的职责：
1. 审查学生提交的课堂学习照片
2. 判断照片是否真实反映了课堂学习状态
3. 给出 0-100 分的评分和详细评语
4. 如果照片不合格，说明原因和改进建议

评分标准：
- 90-100：照片清晰显示认真学习状态（课本、笔记、黑板等学习元素）
- 70-89：照片基本合格，但有小问题（角度不佳、部分模糊等）
- 50-69：照片勉强合格，学习状态不明显
- 0-49：照片不合格（空白、非学习场景、作弊嫌疑等）

输出格式（JSON）：
{
  "passed": true/false,
  "score": 分数,
  "review": "评语，50字内",
  "suggestion": "改进建议，30字内（如通过则为空）"
}

注意：
- 必须严格审查，不能轻易放过不合格照片
- 评语要具体指出看到了什么、有什么问题
- 如果照片明显是作弊（拍桌面、拍天花板等），直接给0分`;

export async function verifyClassPhoto(photoBase64: string, subject: string): Promise<VerifyResult> {
  const state = useStore.getState()
  const ai = state.ai
  // 双AI模式下优先使用二号AI做视觉验证
  const verifyAI = state.aiMode === 'dual' && state.ai2.apiKey?.trim() ? state.ai2 : ai
  if (!verifyAI.apiKey?.trim()) {
    return { passed: true, score: 85, review: 'AI验证官离线，自动通过', suggestion: '' }
  }

  const startTime = Date.now()
  logger.info('verify', `开始验证 ${subject} 课打卡照片`, {
    model: verifyAI.model,
    mode: state.aiMode,
    photoSize: photoBase64.length
  })

  try {
    // 多模态格式：完整发送照片（不截断）
    const imageUrl = photoBase64.startsWith('data:')
      ? photoBase64
      : `data:image/jpeg;base64,${photoBase64}`

    const messages = [
      { role: 'system', content: VERIFY_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: `请审查这张${subject}课的打卡照片。` },
          { type: 'image_url', image_url: { url: imageUrl } }
        ]
      }
    ]

    const resp = await fetch(buildChatUrl(verifyAI.endpoint), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${verifyAI.apiKey}`
      },
      body: JSON.stringify({
        model: verifyAI.model,
        messages,
        temperature: 0.3,
        max_tokens: 300
      })
    })

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '')
      logger.error('verify', `验证 API 返回 ${resp.status}`, { body: errText.slice(0, 300) })
      throw new Error(`API错误: ${resp.status}`)
    }
    const data = await resp.json()
    const text = data.choices?.[0]?.message?.content || ''

    // 尝试解析JSON
    const jsonMatch = text.match(/\{[\s\S]*?\}/)
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0])
      const verifyResult = {
        passed: result.passed ?? true,
        score: Math.max(0, Math.min(100, Math.round(result.score || 0))),
        review: result.review || '验证完成',
        suggestion: result.suggestion || ''
      }
      logger.info('verify', `${subject} 课验证完成`, {
        passed: verifyResult.passed,
        score: verifyResult.score,
        elapsed: Date.now() - startTime
      })
      return verifyResult
    }

    // 回退：简单解析
    const score = text.includes('分') ? parseInt(text.match(/(\d+)/)?.[0] || '80') : 80
    return {
      passed: score >= 60,
      score,
      review: text.slice(0, 50),
      suggestion: ''
    }
  } catch (e) {
    logger.error('verify', '照片验证失败，降级为自动通过', { error: String(e), elapsed: Date.now() - startTime })
    return { passed: true, score: 80, review: '验证服务异常，自动通过', suggestion: '' }
  }
}

// 验证AI向监守者AI汇报
export async function reportToWarden(report: string): Promise<void> {
  const pushChat = useStore.getState().pushChat
  pushChat({
    role: 'system',
    text: `[验证官汇报] ${report}`
  })
}