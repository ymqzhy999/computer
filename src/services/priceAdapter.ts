import type { PriceSnapshot } from '../types'

export interface QuoteUpdate {
  productId: string
  price: PriceSnapshot
}

interface QuoteResponse {
  adapter: string
  fetchedAt: string
  quotes: QuoteUpdate[]
  warnings?: string[]
}

/**
 * Price adapter boundary. The frontend never holds marketplace credentials.
 * A FastAPI adapter can return verified quotes; without it we keep archived samples.
 */
export async function refreshQuotes(productIds: string[]): Promise<QuoteResponse> {
  if (!productIds.length) return { adapter: 'none', fetchedAt: new Date().toISOString(), quotes: [] }
  if (typeof window !== 'undefined' && window.electronAPI?.price) {
    try {
      return await window.electronAPI.price.quotes(productIds)
    } catch {}
  }
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 6500)
  try {
    const response = await fetch('/api/prices/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productIds, region: 'CN', currency: 'CNY' }),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`价格服务返回 HTTP ${response.status}`)
    const data = (await response.json()) as QuoteResponse
    if (!Array.isArray(data.quotes)) throw new Error('价格服务响应缺少 quotes 数组')
    return data
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function adapterHealth(): Promise<{ configured: boolean; adapter: string; message: string }> {
  if (typeof window !== 'undefined' && window.electronAPI?.price) {
    try {
      return await window.electronAPI.price.health()
    } catch {}
  }
  try {
    const response = await fetch('/api/prices/health', { signal: AbortSignal.timeout(2500) })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return (await response.json()) as { configured: boolean; adapter: string; message: string }
  } catch {
    return {
      configured: false,
      adapter: 'archive-only',
      message: '实时价格适配器未连接，当前展示归档样本与用户导入价格。',
    }
  }
}
