import type { FastifyPluginAsync } from 'fastify'
import { createWalletAndReceive, sendAll } from '../services/ipponService'
import { log } from '../services/logService'
import AppError, { Err } from '../utils/AppError'

const swapRoutes: FastifyPluginAsync = async (app) => {
  // POST /api/swap
  // Receives a Cashu token into a temporary Ippon wallet and immediately sweeps
  // it back as an optimally denominated token. Proxied server-side to avoid CORS.
  app.post<{ Body: { token: string; jobId?: string } }>('/', async (request) => {
    const { token, jobId } = request.body

    if (!token || typeof token !== 'string') {
      throw new AppError(400, Err.VALIDATION_ERROR, 'Missing required field: token', {
        caller: 'POST /api/swap',
      })
    }

    log.info('[POST /api/swap] Starting denomination swap', { jobId })

    const { access_key, balance, unit } = await createWalletAndReceive(token, jobId)
    const { token: optimized } = await sendAll(access_key, balance, unit)

    log.info('[POST /api/swap] Swap complete')
    return { token: optimized }
  })
}

export default swapRoutes
