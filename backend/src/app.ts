import Fastify, {
  FastifyRequest,
  FastifyReply,
  FastifyInstance,
  FastifyError,
} from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import AppError from './utils/AppError'
import recoveryRoutes from './routes/recovery'

export async function buildApp(): Promise<FastifyInstance> {
  const app: FastifyInstance = Fastify({
    trustProxy: true,
    bodyLimit: 10 * 1024 * 1024, // 10 MB — batches contain large cryptographic payloads
    logger:
      process.env.NODE_ENV !== 'test'
        ? { timestamp: () => `, "time":"${new Date().toISOString()}"` }
        : false,
  })

  await app.register(cors, {
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(','),
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'X-Cashu'],
    exposedHeaders: ['X-Cashu'],
  })

  await app.register(rateLimit, {
    global: false,
    max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
    timeWindow: process.env.RATE_LIMIT_WINDOW || '1 minute',
  })

  app.setErrorHandler(
    (err: FastifyError | AppError, _req: FastifyRequest, res: FastifyReply) => {
      if (err instanceof AppError) {
        const { statusCode, name, message, params } = err
        return res.code(statusCode).send({ error: { statusCode, name, message, params } })
      }
      const statusCode = err.statusCode ?? 500
      return res.code(statusCode).send({ error: { statusCode, name: err.name, message: err.message } })
    },
  )

  app.get('/health', async () => ({ status: 'ok' }))

  await app.register(recoveryRoutes, { prefix: '/api/recovery' })

  return app
}
