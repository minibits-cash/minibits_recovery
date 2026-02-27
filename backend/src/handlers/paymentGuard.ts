import { PaymentRequest, getDecodedToken } from '@cashu/cashu-ts'
import type { FastifyRequest, FastifyReply } from 'fastify'
import AppError, { Err } from '../utils/AppError'
import { log } from '../services/logService'
import { collectPayment } from '../services/cashuPaymentService'

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

function buildPaymentRequest(): string {
  const pr = new PaymentRequest(
    undefined, // no transport — NUT-24 payment is delivered in-band via X-Cashu header
    undefined, // no id
    PAYMENT_AMOUNT,
    PAYMENT_UNIT,
    undefined, // accept any mint
    'Minibits recovery service fee',
    true, // single use
  )
  return pr.toEncodedCreqA()
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
    log.info('[paymentGuard] 402 — no cashu token provided', { ip })
    reply.header('X-Cashu', encoded)
    return reply.code(402).send({
      error: {
        statusCode: 402,
        name: 'PaymentRequired',
        message: `To protect the mint against abuse, please pay ${PAYMENT_AMOUNT} ${PAYMENT_UNIT}, or wait for next free round in ${WINDOW_MS / 60_000} minutes.`,
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

  // Verify unit
  if (decoded.unit && decoded.unit !== PAYMENT_UNIT) {
    throw new AppError(400, Err.VALIDATION_ERROR, `Cashu token unit must be '${PAYMENT_UNIT}'`, {
      caller: 'paymentGuard',
      unit: decoded.unit,
      cashuHeader
    })
  }

  // Verify amount
  const tokenAmount = decoded.proofs.reduce((sum, p) => sum + p.amount, 0)
  if (tokenAmount < PAYMENT_AMOUNT) {
    throw new AppError(
      400,
      Err.VALIDATION_ERROR,
      `Insufficient payment: got ${tokenAmount} ${PAYMENT_UNIT}, need ${PAYMENT_AMOUNT} ${PAYMENT_UNIT}`,
      { caller: 'paymentGuard', tokenAmount, required: PAYMENT_AMOUNT, cashuHeader },
    )
  }

  log.debug('[paymentGuard] Collecting payment', { ip, tokenAmount })
  await collectPayment(cashuHeader)

  entry.count++
  log.info('[paymentGuard] Payment accepted, recovery allowed', {
    ip,
    tokenAmount,
    count: entry.count,
  })
}
