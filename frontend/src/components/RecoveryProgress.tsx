import React, { useEffect, useState } from 'react'
import { pollRecovery } from '@/lib/api'
import type { PollResponse } from '@/lib/types'

interface RecoveryProgressProps {
  jobId: string
  mintUrl: string
  onComplete: (result: PollResponse) => void
}

const RecoveryProgress = ({ jobId, mintUrl, onComplete }: RecoveryProgressProps) => {
  const [dots, setDots] = useState('.')
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const dotsInterval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '.' : d + '.'))
    }, 500)
    const elapsedInterval = setInterval(() => {
      setElapsed((e) => e + 1)
    }, 1000)
    return () => {
      clearInterval(dotsInterval)
      clearInterval(elapsedInterval)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function poll() {
      while (!cancelled) {
        await new Promise((r) => setTimeout(r, 2000))
        if (cancelled) break
        try {
          const res = await pollRecovery(jobId)
          if (res.status === 'COMPLETED' || res.status === 'ERROR') {
            if (!cancelled) onComplete(res)
            return
          }
        } catch {
          // transient error, keep polling
        }
      }
    }

    poll()
    return () => {
      cancelled = true
    }
  }, [jobId, onComplete])

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-8">
      <div className="flex flex-col items-center text-center">
        {/* Spinner */}
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border-4 border-zinc-700 border-t-[#f18805] animate-spin" />

        <h3 className="karla-bold mb-2 text-xl text-zinc-100">Recovery in progress{dots}</h3>
        <p className="karla-regular mb-1 text-sm text-zinc-400">
          Contacting mint and scanning for proofs
        </p>
        <p className="font-ibm-plex-mono text-xs text-zinc-500">{mintUrl}</p>

        <div className="mt-6 rounded bg-zinc-800 px-6 py-3 font-ibm-plex-mono text-sm text-zinc-300">
          Elapsed: {elapsed}s
        </div>

        <p className="mt-4 font-ibm-plex-mono text-xs text-zinc-500">
          This may take up to a minute for large wallets.
        </p>
      </div>
    </div>
  )
}

export default RecoveryProgress
