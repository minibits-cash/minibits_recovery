import 'dotenv/config'
import { log } from './services/logService'
import { buildApp } from './app'

const app = await buildApp()

app.listen(
  {
    host: '0.0.0.0',
    port: parseInt(process.env.PORT ?? '3003'),
  },
  (err: Error | null) => {
    if (err) {
      console.error(err)
      process.exit(1)
    }
    log.info('minibits-recovery backend started', {
      port: process.env.PORT ?? '3003',
    })
  },
)
