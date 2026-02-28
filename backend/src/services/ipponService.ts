import { log } from './logService'
import AppError, { Err } from '../utils/AppError'

const IPPON_BASE = process.env.IPPON_BASE ?? 'https://ippon.minibits.cash/v1'

interface IpponWallet {
  name: string
  access_key: string
  mint: string
  unit: string
  balance: number
  pending_balance?: number
  limits?: {
    max_balance?: number | null
    max_send?: number | null
    max_pay?: number | null
  } | null
}

interface IpponWalletInfo {
  balance: number
  pending_balance?: number
}

async function ipponFetch(
  path: string,
  options: RequestInit = {},
  accessKey?: string,
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (accessKey) {
    headers['Authorization'] = `Bearer ${accessKey}`
  }

  log.trace('[ipponFetch]', { path, method: options.method ?? 'GET' })

  const res = await fetch(`${IPPON_BASE}${path}`, { ...options, headers })
  if (!res.ok) {
    const body = await res.text()
    throw new AppError(502, Err.CONNECTION_ERROR, `Ippon API error ${res.status} on ${path}: ${body}`, {
      caller: 'ipponFetch',
      path,
      status: res.status,
    })
  }
  return res
}

export async function createWallet(name?: string): Promise<IpponWallet> {
  log.info('[ipponService] Creating wallet', { name })
  const res = await ipponFetch('/wallet', {
    method: 'POST',
    body: JSON.stringify({ name: name ?? 'minibits-recovery' }),
  })
  const wallet: IpponWallet = await res.json()
  log.debug('[ipponService] Wallet created', { walletName: wallet.name })
  return wallet
}

/** Create a temporary wallet and immediately receive the provided token into it. */
export async function createWalletAndReceive(token: string, jobId?: string): Promise<IpponWallet> {
  const name = jobId ? `minibits-recovery-swap-${jobId}` : 'minibits-recovery-swap'
  log.info('[ipponService] Creating wallet with token', { name })
  const res = await ipponFetch('/wallet', {
    method: 'POST',
    body: JSON.stringify({ name, token }),
  })
  const wallet: IpponWallet = await res.json()
  log.debug('[ipponService] Wallet created and token received', { walletName: wallet.name })
  return wallet
}

export async function receiveToken(accessKey: string, token: string): Promise<{ balance: number }> {
  log.info('[ipponService] Receiving token into wallet', {token})
  const res = await ipponFetch(
    '/wallet/receive',
    { method: 'POST', body: JSON.stringify({ token }) },
    accessKey,
  )
  const data: { balance: number } = await res.json()
  log.debug('[ipponService] Token received', { balance: data.balance })
  return data
}

export async function getWalletInfo(accessKey: string): Promise<IpponWalletInfo> {
  const res = await ipponFetch('/wallet', {}, accessKey)
  return res.json()
}

export async function sendAll(accessKey: string, amount: number, unit: string): Promise<{ token: string }> {
  log.info('[ipponService] Sweeping wallet to token', { amount, unit })
  const res = await ipponFetch(
    '/wallet/send',
    { method: 'POST', body: JSON.stringify({ amount, unit }) },
    accessKey,
  )
  const data: { token: string } = await res.json()
  log.debug('[ipponService] Sweep complete, token length', { length: data.token.length })
  return data
}
