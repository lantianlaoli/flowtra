/**
 * KIE Sora2 Pro API Integration
 *
 * This module provides integration with KIE's Sora2 Pro Image-to-Video API.
 * Sora2 Pro supports multiple quality levels and durations:
 * - Standard 10s: 75 credits
 * - Standard 15s: 135 credits
 * - HD 10s: 165 credits
 * - HD 15s: 315 credits
 */

const KIE_API_BASE_URL = 'https://api.kie.ai/api/v1/jobs'

export interface Sora2ProCreateTaskOptions {
  prompt: string
  image_urls: string[]
  aspect_ratio: 'portrait' | 'landscape'
  n_frames: '10' | '15'
  size: 'standard' | 'high'
  remove_watermark?: boolean
  callBackUrl?: string
}

export interface Sora2ProCreateTaskResponse {
  code: number
  msg: string
  data: {
    taskId: string
  }
}

export interface Sora2ProTaskStatusResponse {
  code: number
  msg: string
  data: {
    taskId: string
    model: string
    state: 'waiting' | 'success' | 'fail'
    param: string
    resultJson: string
    failCode: string | null
    failMsg: string | null
    costTime: number | null
    completeTime: number | null
    createTime: number
  }
}

/**
 * Create a Sora2 Pro video generation task
 */
export async function createSora2ProTask(
  options: Sora2ProCreateTaskOptions
): Promise<Sora2ProCreateTaskResponse> {
  const apiKey = process.env.KIE_API_KEY

  if (!apiKey) {
    throw new Error('KIE_API_KEY is not configured')
  }

  const response = await fetch(`${KIE_API_BASE_URL}/createTask`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sora-2-pro-image-to-video',
      input: {
        prompt: options.prompt,
        image_urls: options.image_urls,
        aspect_ratio: options.aspect_ratio,
        n_frames: options.n_frames,
        size: options.size,
        remove_watermark: options.remove_watermark ?? true
      },
      callBackUrl: options.callBackUrl
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`KIE API error (${response.status}): ${errorText}`)
  }

  const result = await response.json()

  if (result.code !== 200) {
    throw new Error(`KIE API returned error: ${result.msg}`)
  }

  return result
}

/**
 * Query the status of a Sora2 Pro task
 */
export async function querySora2ProTaskStatus(
  taskId: string
): Promise<Sora2ProTaskStatusResponse> {
  const apiKey = process.env.KIE_API_KEY

  if (!apiKey) {
    throw new Error('KIE_API_KEY is not configured')
  }

  const response = await fetch(
    `${KIE_API_BASE_URL}/recordInfo?taskId=${taskId}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      }
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`KIE API error (${response.status}): ${errorText}`)
  }

  const result = await response.json()

  if (result.code !== 200) {
    throw new Error(`KIE API returned error: ${result.msg}`)
  }

  return result
}

/**
 * Parse result JSON from task status response
 */
export function parseSora2ProResult(resultJson: string): { resultUrls: string[] } | null {
  try {
    const parsed = JSON.parse(resultJson)
    return parsed
  } catch (error) {
    console.error('Failed to parse Sora2 Pro result JSON:', error)
    return null
  }
}

/**
 * Map aspect ratio from video format to Sora2 Pro format
 */
export function mapAspectRatioToSora2ProFormat(videoAspectRatio: string): 'portrait' | 'landscape' {
  if (videoAspectRatio === '9:16') {
    return 'portrait'
  }
  return 'landscape' // Default to landscape for 16:9 and others
}

/**
 * Get the credit cost for Sora2 Pro based on configuration
 */
export function getSora2ProCost(duration: '10' | '15', quality: 'standard' | 'high'): number {
  const costs = {
    'standard': { '10': 75, '15': 135 },
    'high': { '10': 165, '15': 315 }
  }

  return costs[quality][duration]
}
