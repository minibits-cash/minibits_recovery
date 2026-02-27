import type { FastifyPluginAsync } from 'fastify'
import { v4 as uuidv4 } from 'uuid'
import type { JobState, RecoveryRequest } from '../types/index'
import { runRecovery } from '../services/recoveryService'
import { sendAll } from '../services/ipponService'
import { log } from '../services/logService'
import AppError, { Err } from '../utils/AppError'
import { paymentGuard } from '../handlers/paymentGuard'

// In-memory job store
const jobs = new Map<string, JobState>()

// Prune jobs older than 1 hour every 10 minutes
setInterval(
  () => {
    const cutoff = Date.now() - 60 * 60 * 1000
    let pruned = 0
    for (const [id, job] of jobs) {
      if (job.createdAt < cutoff) {
        jobs.delete(id)
        pruned++
      }
    }
    if (pruned > 0) log.debug('[jobStore] Pruned expired jobs', { pruned })
  },
  10 * 60 * 1000,
)

const recoveryRoutes: FastifyPluginAsync = async (app) => {
  // POST /api/recovery
  app.post<{ Body: RecoveryRequest }>('/', {
    config: {
      rateLimit: {
        max: parseInt(process.env.RATE_LIMIT_RECOVERY_MAX || '5'),
        timeWindow: process.env.RATE_LIMIT_WINDOW || '1 minute',
      },
    },
    preHandler: [paymentGuard],
  }, async (request) => {
    const body = request.body

    if (!body.mintUrl || !body.keysetId || !body.keyset || !Array.isArray(body.batches)) {
      throw new AppError(400, Err.VALIDATION_ERROR, 'Missing required fields: mintUrl, keysetId, keyset, batches', {
        caller: 'POST /api/recovery',
      })
    }
    if (body.batches.length === 0) {
      throw new AppError(400, Err.VALIDATION_ERROR, 'batches array must not be empty', {
        caller: 'POST /api/recovery',
      })
    }
    if (body.batches.length > parseInt(process.env.MAX_BATCHES || '50')) {
      throw new AppError(400, Err.VALIDATION_ERROR, 'Max batches number exceeded', {
        caller: 'POST /api/recovery',
      })
    }
    const maxBatchSize = parseInt(process.env.MAX_BATCH_SIZE || '100')
    const oversized = body.batches.find((b) => b.outputs.length > maxBatchSize)
    if (oversized) {
      throw new AppError(400, Err.VALIDATION_ERROR, `Batch at counter ${oversized.counter} exceeds max batch size of ${maxBatchSize}`, {
        caller: 'POST /api/recovery',
      })
    }

    const jobId = uuidv4()
    const job: JobState = {
      status: 'IN_PROGRESS',
      createdAt: Date.now(),
      mintUrl: body.mintUrl,
    }
    jobs.set(jobId, job)

    log.info('[POST /api/recovery] Job created', {
      jobId,
      mintUrl: body.mintUrl,
      keysetId: body.keysetId,
      batches: body.batches.length,
    })

    // Run recovery async — errors are captured into job state, not thrown
    runRecovery(body, jobId)
      .then((result) => {
        const j = jobs.get(jobId)!
        j.status = 'COMPLETED'
        j.result = result
        log.info('[runRecovery] Job completed', { jobId, proofs: result.proofs, balance: result.balance })
      })
      .catch((err: Error) => {
        const j = jobs.get(jobId)!
        j.status = 'ERROR'
        j.error = err.message
        log.error('[runRecovery] Job failed', { jobId, error: err.message })
      })

    return { jobId, pollUrl: `/api/recovery/${jobId}` }
  })

  // GET /api/recovery/:jobId
  app.get<{ Params: { jobId: string } }>('/:jobId', async (request) => {
    const job = jobs.get(request.params.jobId)
    if (!job) {
      throw new AppError(404, Err.NOTFOUND_ERROR, 'Job not found', {
        caller: 'GET /api/recovery/:jobId',
        jobId: request.params.jobId,
      })
    }
    log.trace('[GET /api/recovery/:jobId]', { jobId: request.params.jobId, status: job.status })
    return {
      status: job.status,
      result: job.result,
      error: job.error,
    }
  })

  // POST /api/recovery/:jobId/sweep
  app.post<{ Params: { jobId: string } }>('/:jobId/sweep', {
    config: {
      rateLimit: {
        max: parseInt(process.env.RATE_LIMIT_RECOVERY_MAX || '5'),
        timeWindow: process.env.RATE_LIMIT_WINDOW || '1 minute',
      },
    },
  }, async (request) => {
    const job = jobs.get(request.params.jobId)
    if (!job) {
      throw new AppError(404, Err.NOTFOUND_ERROR, 'Job not found', {
        caller: 'POST /api/recovery/:jobId/sweep',
        jobId: request.params.jobId,
      })
    }
    if (job.status !== 'COMPLETED' || !job.result?.accessKey) {
      throw new AppError(400, Err.VALIDATION_ERROR, 'Job not completed or no wallet to sweep', {
        caller: 'POST /api/recovery/:jobId/sweep',
        jobId: request.params.jobId,
        status: job.status,
      })
    }
    if (job.result.balance === 0) {
      throw new AppError(400, Err.VALIDATION_ERROR, 'Wallet balance is 0, nothing to sweep', {
        caller: 'POST /api/recovery/:jobId/sweep',
        jobId: request.params.jobId,
      })
    }

    log.info('[POST /api/recovery/:jobId/sweep] Sweeping wallet', {
      jobId: request.params.jobId,
      walletName: job.result.walletName,
    })

    const { token } = await sendAll(job.result.accessKey)
    return { token }
  })
}

export default recoveryRoutes
