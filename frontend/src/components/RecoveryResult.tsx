import React, { useState } from 'react'
import { getDecodedToken } from '@cashu/cashu-ts'
import { swapToken } from '@/lib/api'
import type { RecoveryAttempt } from '@/lib/types'
import clsx from 'clsx'

const RECOMMENDED_SWAP_LIMIT = parseInt(
  process.env.NEXT_PUBLIC_RECOMMENDED_SWAP_LIMIT ?? '100',
)

interface RecoveryResultProps {
  attempt: RecoveryAttempt
  onRetry: () => void
}

const RecoveryResult = ({ attempt, onRetry }: RecoveryResultProps) => {
  const { status, result, error } = attempt
  const [displayToken, setDisplayToken] = useState(result?.token ?? '')
  const [tokenCopied, setTokenCopied] = useState(false)
  const [swapping, setSwapping] = useState(false)
  const [swapError, setSwapError] = useState<string | null>(null)
  const [swapDone, setSwapDone] = useState<{ from: number; to: number } | null>(null)

  async function copyToClipboard(text: string, setFlag: (v: boolean) => void) {
    try {
      await navigator.clipboard.writeText(text)
      setFlag(true)
      setTimeout(() => setFlag(false), 2000)
    } catch {
      // fallback: ignore
    }
  }

  async function handleSwap() {
    if (!displayToken) return
    setSwapping(true)
    setSwapError(null)
    try {
      const { token: optimized } = await swapToken(displayToken, attempt.jobId)
      const newProofCount = getDecodedToken(optimized).proofs.length
      setSwapDone({ from: result!.proofs, to: newProofCount })
      setDisplayToken(optimized)
    } catch (e) {
      setSwapError((e as Error).message)
    } finally {
      setSwapping(false)
    }
  }

  if (status === 'ERROR') {
    return (
      <div className="rounded-lg border border-red-800 bg-red-950 p-6">
        <div className="mb-3 flex items-center gap-2">
          <span className="font-ibm-plex-mono text-[13px] tracking-[-0.02em] text-red-400">
            RECOVERY FAILED
          </span>
        </div>
        <p className="karla-regular text-sm text-red-300">{error ?? 'Unknown error'}</p>
        <p className="mt-1 font-ibm-plex-mono text-xs text-zinc-500">{attempt.mintUrl}</p>
        <button
          onClick={onRetry}
          className="mt-4 rounded bg-zinc-700 px-4 py-2 font-ibm-plex-mono text-sm font-semibold text-white transition hover:bg-zinc-600"
        >
          TRY AGAIN
        </button>
      </div>
    )
  }

  if (!result) return null

  return (
    <div
      className={clsx(
        'rounded-lg border p-6',
        result.balance > 0 ? 'border-green-800 bg-green-950' : 'border-zinc-700 bg-zinc-900',
      )}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <span
          className={clsx(
            'font-ibm-plex-mono text-[13px] tracking-[-0.02em]',
            result.balance > 0 ? 'text-green-400' : 'text-zinc-400',
          )}
        >
          {result.balance > 0
            ? 'RECOVERY SUCCESSFUL'
            : result.totalRecoveredProofs > 0
              ? 'ONLY SPENT PROOFS FOUND'
              : 'NOTHING FOUND'}
        </span>
        <span className="font-ibm-plex-mono text-xs text-zinc-500">
          {new Date(attempt.startedAt).toLocaleTimeString()}
        </span>
      </div>

      {/* Primary stat — sats recovered */}
      <div className="mb-5 text-center">
        <p className="karla-bold text-3xl text-zinc-100">
          {result.balance}{' '}
          <span className="text-xl font-normal text-zinc-400">sat</span>
        </p>
        <p className="font-ibm-plex-mono text-sm text-zinc-400">
          recovered from {result.totalRecoveredProofs} proofs
        </p>
      </div>

      {/* Hint: more proofs may exist in the next batch range */}
      {result.lastFoundInLastBatch && (
        <p className="mb-4 rounded border border-blue-800 bg-blue-950 p-3 font-ibm-plex-mono text-xs text-blue-400">
          Proofs were found in the last scanned batch. Further unspent proofs may exist — consider
          continuing recovery from counter <strong>{result.scannedToCounter + 1}</strong>.
        </p>
      )}

      {result.exhausted && !result.lastFoundInLastBatch && (
        <p className="mb-4 rounded border border-amber-500 bg-[#1c1500] p-3 font-ibm-plex-mono text-xs text-amber-400">
          All provided batches were scanned without reaching the gap limit. If you believe more
          proofs exist, retry from counter <strong>{result.scannedToCounter + 1}</strong>.
        </p>
      )}

      <p className="mb-4 font-ibm-plex-mono text-xs text-zinc-500 text-center">
        Keyset: {attempt.keysetId} · Counters scanned: {attempt.startCounter}–{result.scannedToCounter}
      </p>

      {result.balance > 0 && (
        <>
          {/* Token preview */}
          <div className="mb-4">
            <label className="ibm-plex-mono-medium mb-1 block text-[12px] tracking-[-0.01em] text-zinc-400">
              CASHU TOKEN — copy and import into your wallet
            </label>
            <textarea
              readOnly
              value={displayToken}
              rows={3}
              className="w-full resize-none rounded border border-zinc-700 bg-zinc-800 p-3 font-ibm-plex-mono text-xs text-zinc-300 focus:outline-none"
            />
            <button
              onClick={() => copyToClipboard(displayToken, setTokenCopied)}
              className="mt-2 w-full rounded bg-green-600 px-4 py-2 font-ibm-plex-mono text-sm text-white transition hover:bg-green-700"
            >
              {tokenCopied ? '✓ Token Copied!' : 'COPY TOKEN'}
            </button>
          </div>

          {/* Swap to optimal denominations */}
          {result.proofs > RECOMMENDED_SWAP_LIMIT && (
            <div className="mb-4">
              {swapDone ? (
                <p className="font-ibm-plex-mono text-xs text-green-400">
                  ✓ Proofs consolidated from {swapDone.from} to {swapDone.to}
                </p>
              ) : (
                <>
                  <button
                    onClick={handleSwap}
                    disabled={swapping}
                    className="w-full rounded bg-zinc-700 px-4 py-3 font-ibm-plex-mono text-sm font-semibold text-white transition hover:bg-zinc-600 disabled:opacity-60"
                  >
                    {swapping ? 'SWAPPING…' : 'SWAP TO OPTIMAL DENOMINATIONS'}
                  </button>
                  <p className="mt-1 font-ibm-plex-mono text-xs text-zinc-500">
                    {result.proofs} proofs recovered — swapping consolidates them into fewer, optimal ecash notes.
                  </p>
                  {swapError && (
                    <p className="mt-2 font-ibm-plex-mono text-xs text-red-400">{swapError}</p>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}

      <button
        onClick={onRetry}
        className="w-full rounded border border-zinc-700 px-4 py-2 font-ibm-plex-mono text-sm text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200"
      >
        CONTINUE OR CHANGE SETTINGS
      </button>
    </div>
  )
}

export default RecoveryResult
