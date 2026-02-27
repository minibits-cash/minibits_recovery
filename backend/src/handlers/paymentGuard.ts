import { PaymentRequest, Wallet, getDecodedToken, getEncodedTokenV4 } from '@cashu/cashu-ts'
import type { FastifyRequest, FastifyReply } from 'fastify'
import AppError, { Err } from '../utils/AppError'
import { log } from '../services/logService'
import { receiveToken } from '../services/ipponService'

const PAYMENT_AMOUNT = parseInt(process.env.PAYMENT_AMOUNT_SAT || '100')
const PAYMENT_UNIT = 'sat'
const FREE_REQUESTS = parseInt(process.env.PAYMENT_FREE_REQUESTS || '1')
const WINDOW_MS = parseInt(process.env.PAYMENT_WINDOW_MS || String(60 * 60 * 1000))

interface IpEntry {
  firstRequestAt: number
  count: number
}

// Per-IP tracking: first FREE_REQUESTS recoveries per window are free, subsequent require payment
const ipTracker = new Map<string, IpEntry>()

// Prune stale IP entries at half the window interval (minimum 1 minute)
setInterval(
  () => {
    const cutoff = Date.now() - WINDOW_MS
    let pruned = 0
    for (const [ip, entry] of ipTracker) {
      if (entry.firstRequestAt < cutoff) {
        ipTracker.delete(ip)
        pruned++
      }
    }
    if (pruned > 0) log.debug('[paymentGuard] Pruned stale IP entries', { pruned })
  },
  Math.max(Math.floor(WINDOW_MS / 2), 60_000),
)

function acceptedMints(): string[] {
  return (process.env.PAYMENT_MINT_URLS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function buildPaymentRequest(): string {
  const mints = acceptedMints()
  const pr = new PaymentRequest(
    undefined, // no transport — NUT-24 payment is delivered in-band via X-Cashu header
    undefined, // no id
    PAYMENT_AMOUNT,
    PAYMENT_UNIT,
    mints.length > 0 ? mints : undefined,
    'Minibits recovery service fee',
    true, // single use
  )
  return pr.toEncodedCreqA()
}

/**
 * Swaps the payment token at the mint (marks original proofs as spent) and deposits
 * the resulting fresh proofs into the configured collection ippon wallet.
 */
async function redeemToken(cashuHeader: string, mintUrl: string): Promise<void> {
  const wallet = new Wallet(mintUrl, { unit: PAYMENT_UNIT })
  await wallet.loadMint()

  let freshProofs: Awaited<ReturnType<typeof wallet.receive>>
  try {
    freshProofs = await wallet.receive(cashuHeader)
  } catch (e: any) {
    throw new AppError(400, Err.VALIDATION_ERROR, 'Payment token is invalid or already spent', {
      caller: 'paymentGuard',
      message: e.message,
      mintUrl,
    })
  }

  log.info('[paymentGuard] Payment token redeemed at mint', { mintUrl, proofs: freshProofs.length })

  const freshToken = getEncodedTokenV4({ mint: mintUrl, proofs: freshProofs, unit: PAYMENT_UNIT })
  const collectionKey = process.env.PAYMENT_COLLECTION_ACCESS_KEY?.trim()
  
  if (!collectionKey) {
    log.warn('[paymentGuard] PAYMENT_COLLECTION_ACCESS_KEY not configured — skipping deposit of fresh proofs to collection wallet')
    log.warn('[paymentGuard]', freshToken)
    return
  }

  
  const { balance } = await receiveToken(collectionKey, freshToken)
  log.info('[paymentGuard] Fresh proofs deposited to collection wallet', { balance })
}

export async function paymentGuard(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const ip = request.ip
  const now = Date.now()
  const entry = ipTracker.get(ip)
  const windowActive = entry !== undefined && now - entry.firstRequestAt < WINDOW_MS

  if (!windowActive) {
    // Window expired or first-ever request — reset tracking and grant free pass
    ipTracker.set(ip, { firstRequestAt: now, count: 1 })
    log.debug('[paymentGuard] Free recovery granted (new window)', { ip })
    return
  }

  if (entry.count < FREE_REQUESTS) {
    // Still within the free quota for this window
    entry.count++
    log.debug('[paymentGuard] Free recovery granted', { ip, count: entry.count, freeRequests: FREE_REQUESTS })
    return
  }

  // Free quota exhausted — payment required
  log.debug('[paymentGuard] Paid recovery required', { ip, count: entry.count })

  const cashuHeader = (request.headers['x-cashu'] as string | undefined)?.trim()

  if (!cashuHeader) {
    const encoded = buildPaymentRequest()
    log.info('[paymentGuard] 402 — no payment token provided', { ip })
    reply.header('X-Cashu', encoded)
    return reply.code(402).send({
      error: {
        statusCode: 402,
        name: 'PaymentRequired',
        message: `Payment of ${PAYMENT_AMOUNT} ${PAYMENT_UNIT} required after ${FREE_REQUESTS} free ${FREE_REQUESTS === 1 ? 'recovery' : 'recoveries'} per ${WINDOW_MS / 60_000} minutes`,
      },
    })
  }

  // Decode and validate the payment token
  let decoded: ReturnType<typeof getDecodedToken>
  try {
    decoded = getDecodedToken(cashuHeader)
  } catch {
    throw new AppError(400, Err.VALIDATION_ERROR, 'Invalid X-Cashu payment token', {
      caller: 'paymentGuard',
    })
  }

  // Verify mint is in the accepted list (when configured)
  const mints = acceptedMints()
  if (mints.length > 0 && !mints.includes(decoded.mint)) {
    throw new AppError(400, Err.VALIDATION_ERROR, 'Payment token mint not accepted', {
      caller: 'paymentGuard',
      mint: decoded.mint,
    })
  }

  // Verify unit
  if (decoded.unit && decoded.unit !== PAYMENT_UNIT) {
    throw new AppError(400, Err.VALIDATION_ERROR, `Payment token unit must be '${PAYMENT_UNIT}'`, {
      caller: 'paymentGuard',
      unit: decoded.unit,
    })
  }

  // Verify amount
  const totalAmount = decoded.proofs.reduce((sum, p) => sum + p.amount, 0)
  if (totalAmount < PAYMENT_AMOUNT) {
    throw new AppError(
      400,
      Err.VALIDATION_ERROR,
      `Insufficient payment: got ${totalAmount} ${PAYMENT_UNIT}, need ${PAYMENT_AMOUNT} ${PAYMENT_UNIT}`,
      { caller: 'paymentGuard', totalAmount, required: PAYMENT_AMOUNT },
    )
  }

  // Swap the token at the mint — marks original proofs as spent (mint-level double-spend prevention)
  // and deposits the resulting fresh proofs into the collection wallet
  await redeemToken(cashuHeader, decoded.mint)

  entry.count++
  log.info('[paymentGuard] Payment accepted, recovery allowed', {
    ip,
    totalAmount,
    count: entry.count,
  })
}
