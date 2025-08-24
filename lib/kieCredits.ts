'use server'

import { fetchWithRetry } from './fetchWithRetry'

// KIE平台积分消耗定义 - 移到函数内部避免导出对象
const KIE_CREDIT_COSTS = {
  COVER_GENERATION: 3,    // 封面生成：3积分
  VIDEO_VEO3_FAST: 60,    // Veo3 Fast视频：60积分
  VIDEO_VEO3: 300,        // Veo3高质量视频：300积分
} as const

// 计算完整流程所需的最大积分（最坏情况：封面 + Veo3高质量）
const FULL_WORKFLOW_MAX_CREDITS = KIE_CREDIT_COSTS.COVER_GENERATION + KIE_CREDIT_COSTS.VIDEO_VEO3

/**
 * 检查KIE API积分余额
 */
export async function checkKieCredits(): Promise<{
  success: boolean
  credits?: number
  error?: string
}> {
  try {
    const response = await fetchWithRetry('https://api.kie.ai/api/v1/chat/credit', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
        'Content-Type': 'application/json',
      },
    }, 3, 10000) // 3 retries, 10 second timeout

    if (!response.ok) {
      console.error('KIE credits check failed:', response.status, response.statusText)
      return {
        success: false,
        error: `Failed to check KIE credits: ${response.status}`
      }
    }

    const data = await response.json()
    
    if (data.code !== 200) {
      console.error('KIE credits API returned error:', data)
      return {
        success: false,
        error: data.msg || 'Failed to get KIE credits'
      }
    }

    const credits = data.data
    
    if (typeof credits !== 'number') {
      console.error('Invalid KIE credits response:', data)
      return {
        success: false,
        error: 'Invalid credits response format'
      }
    }

    return {
      success: true,
      credits
    }
  } catch (error) {
    console.error('KIE credits check error:', error)
    return {
      success: false,
      error: 'Network error while checking KIE credits'
    }
  }
}

/**
 * 检查KIE积分是否足够执行完整的AI广告生成流程
 * @returns Promise<{sufficient: boolean, currentCredits: number, requiredCredits: number, error?: string}>
 */
export async function checkKieCreditsForFullWorkflow(): Promise<{
  sufficient: boolean
  currentCredits: number
  requiredCredits: number
  error?: string
}> {
  const creditCheck = await checkKieCredits()
  
  if (!creditCheck.success) {
    return {
      sufficient: false,
      currentCredits: 0,
      requiredCredits: FULL_WORKFLOW_MAX_CREDITS,
      error: creditCheck.error
    }
  }

  const currentCredits = creditCheck.credits || 0
  const sufficient = currentCredits >= FULL_WORKFLOW_MAX_CREDITS

  console.log(`KIE Credits Check: ${currentCredits}/${FULL_WORKFLOW_MAX_CREDITS} (${sufficient ? 'SUFFICIENT' : 'INSUFFICIENT'})`)

  return {
    sufficient,
    currentCredits,
    requiredCredits: FULL_WORKFLOW_MAX_CREDITS
  }
}

/**
 * 根据视频模型获取所需的KIE积分
 */
export async function getVideoKieCredits(model: 'veo3' | 'veo3_fast'): Promise<number> {
  return model === 'veo3' ? KIE_CREDIT_COSTS.VIDEO_VEO3 : KIE_CREDIT_COSTS.VIDEO_VEO3_FAST
}