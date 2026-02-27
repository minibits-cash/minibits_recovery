import { decodePaymentRequest } from '@cashu/cashu-ts'
import type { RecoveryRequest, PollResponse, PaymentRequired } from './types'

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`API error ${res.status}: ${body}`)
  }
  return res.json() as Promise<T>
}

export type StartRecoveryResult =
  | { kind: 'started'; jobId: string; pollUrl: string }
  | { kind: 'payment_required'; paymentRequired: PaymentRequired }

export async function startRecovery(
  req: RecoveryRequest,
  cashuToken?: string,
): Promise<StartRecoveryResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cashuToken) {
    headers['X-Cashu'] = cashuToken
  }

  const res = await fetch(`${API_BASE}/api/recovery`, {
    method: 'POST',
    headers,
    body: JSON.stringify(req),
  })

  if (res.status === 402) {
    const encodedRequest = res.headers.get('x-cashu') ?? ''
    const body = await res.json().catch(() => ({}))
    const message = body?.error?.message ?? 'Payment required'

    let amount = 0
    let unit = 'sat'
    let mints: string[] = []
    try {
      const pr = decodePaymentRequest(encodedRequest)
      amount = pr.amount ?? 0
      unit = pr.unit ?? 'sat'
      mints = pr.mints ?? []
    } catch {
      // keep defaults
    }

    return { kind: 'payment_required', paymentRequired: { encodedRequest, message, amount, unit, mints } }
  }

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`API error ${res.status}: ${body}`)
  }

  const data = await res.json()
  return { kind: 'started', jobId: data.jobId, pollUrl: data.pollUrl }
}

export async function pollRecovery(jobId: string): Promise<PollResponse> {
  return apiFetch(`/api/recovery/${jobId}`)
}

const IPPON_BASE =
  process.env.NEXT_PUBLIC_IPPON_BASE ?? 'https://ippon.minibits.cash/v1'

async function ipponFetch<T>(path: string, init?: RequestInit, accessKey?: string): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (accessKey) headers['Authorization'] = `Bearer ${accessKey}`
  const res = await fetch(`${IPPON_BASE}${path}`, { ...init, headers })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Ippon error ${res.status}: ${body}`)
  }
  return res.json() as Promise<T>
}

/** Create a wallet and immediately receive the provided token into it. */
export async function ipponCreateWallet(token: string): Promise<{ name: string; access_key: string }> {
  return ipponFetch('/wallet', { method: 'POST', body: JSON.stringify({ name: 'minibits-recovery', token }) })
}

export async function ipponSendAll(accessKey: string): Promise<{ token: string }> {
  return ipponFetch('/wallet/send', { method: 'POST', body: JSON.stringify({}) }, accessKey)
}
