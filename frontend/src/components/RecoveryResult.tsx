import React, { useState } from 'react'
import { sweepWallet } from '@/lib/api'
import type { RecoveryAttempt } from '@/lib/types'
import clsx from 'clsx'

interface RecoveryResultProps {
  attempt: RecoveryAttempt
  onRetry: () => void
}

const RecoveryResult = ({ attempt, onRetry }: RecoveryResultProps) => {
  const { status, result, error } = attempt
  const [copied, setCopied] = useState(false)
  const [sweeping, setSweeping] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [tokenCopied, setTokenCopied] = useState(false)
  const [sweepError, setSweepError] = useState<string | null>(null)

  async function copyToClipboard(text: string, setFlag: (v: boolean) => void) {
    try {
      await navigator.clipboard.writeText(text)
      setFlag(true)
      setTimeout(() => setFlag(false), 2000)
    } catch {
      // fallback
    }
  }

  async function handleSweep() {
    if (!result) return
    setSweeping(true)
    setSweepError(null)
    try {
      const res = await sweepWallet(attempt.jobId)
      setToken(res.token)
    } catch (e) {
      setSweepError((e as Error).message)
    } finally {
      setSweeping(false)
    }
  }

  if (status === 'ERROR') {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <span className="font-ibm-plex-mono text-[13px] tracking-[-0.02em] text-red-600">
            RECOVERY FAILED
          </span>
        </div>
        <p className="karla-regular text-sm text-red-700">{error ?? 'Unknown error'}</p>
        <p className="mt-1 font-ibm-plex-mono text-xs text-gray-400">{attempt.mintUrl}</p>
        <button
          onClick={onRetry}
          className="mt-4 bg-black px-4 py-2 font-ibm-plex-mono text-sm font-semibold text-white transition hover:bg-gray-800"
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
        'rounded-lg border p-6 shadow-sm',
        result.balance > 0 ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50',
      )}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <span
          className={clsx(
            'font-ibm-plex-mono text-[13px] tracking-[-0.02em]',
            result.balance > 0 ? 'text-green-700' : 'text-gray-500',
          )}
        >
          {result.balance > 0 ? 'RECOVERY SUCCESSFUL' : 'NOTHING FOUND'}
        </span>
        <span className="font-ibm-plex-mono text-xs text-gray-400">
          {new Date(attempt.startedAt).toLocaleTimeString()}
        </span>
      </div>

      {/* Stats grid */}
      <div className="mb-5 grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="karla-bold text-2xl text-gray-900">{result.balance}</p>
          <p className="font-ibm-plex-mono text-xs text-gray-500">sats recovered</p>
        </div>
        <div>
          <p className="karla-bold text-2xl text-gray-900">{result.proofs}</p>
          <p className="font-ibm-plex-mono text-xs text-gray-500">unspent proofs</p>
        </div>
        <div>
          <p className="karla-bold text-2xl text-gray-900">{result.lastCounter}</p>
          <p className="font-ibm-plex-mono text-xs text-gray-500">last counter</p>
        </div>
      </div>

      {result.exhausted && (
        <p className="mb-4 rounded border border-amber-200 bg-amber-50 p-3 font-ibm-plex-mono text-xs text-amber-700">
          All provided batches were scanned. If you believe more proofs exist, retry from counter{' '}
          <strong>{result.lastCounter + 1}</strong>.
        </p>
      )}

      <p className="mb-4 font-ibm-plex-mono text-xs text-gray-400">
        Keyset: {attempt.keysetId} · Mint: {attempt.mintUrl}
      </p>

      {result.balance > 0 && (
        <>
          {/* Access key */}
          <div className="mb-4">
            <label className="ibm-plex-mono-medium mb-1 block text-[12px] tracking-[-0.01em] text-gray-500">
              IPPON WALLET ACCESS KEY
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-white px-3 py-2 font-ibm-plex-mono text-xs text-gray-800 shadow-inner">
                {result.accessKey}
              </code>
              <button
                onClick={() => copyToClipboard(result.accessKey, setCopied)}
                className="flex-shrink-0 rounded bg-gray-100 px-3 py-2 font-ibm-plex-mono text-xs text-gray-700 transition hover:bg-gray-200"
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <p className="mt-1 font-ibm-plex-mono text-xs text-gray-400">
              Use this key to access your wallet at{' '}
              <a
                href="https://ippon.minibits.cash"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                ippon.minibits.cash
              </a>
            </p>
          </div>

          {/* Sweep to token */}
          {!token && (
            <button
              onClick={handleSweep}
              disabled={sweeping}
              className="mb-3 w-full bg-black px-4 py-3 font-ibm-plex-mono text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-60"
            >
              {sweeping ? 'SWEEPING…' : 'SWEEP TO CASHU TOKEN'}
            </button>
          )}

          {sweepError && (
            <p className="mb-3 font-ibm-plex-mono text-xs text-red-500">{sweepError}</p>
          )}

          {token && (
            <div className="mb-4">
              <label className="ibm-plex-mono-medium mb-1 block text-[12px] tracking-[-0.01em] text-gray-500">
                CASHU TOKEN — copy and import into your wallet
              </label>
              <textarea
                readOnly
                value={token}
                rows={4}
                className="w-full resize-none rounded border border-gray-300 bg-white p-3 font-ibm-plex-mono text-xs text-gray-800 focus:outline-none"
              />
              <button
                onClick={() => copyToClipboard(token, setTokenCopied)}
                className="mt-2 w-full rounded bg-gray-100 px-4 py-2 font-ibm-plex-mono text-sm text-gray-700 transition hover:bg-gray-200"
              >
                {tokenCopied ? '✓ Token Copied!' : 'COPY TOKEN'}
              </button>
            </div>
          )}
        </>
      )}

      <button
        onClick={onRetry}
        className="w-full border border-gray-300 px-4 py-2 font-ibm-plex-mono text-sm text-gray-600 transition hover:border-gray-400 hover:text-gray-800"
      >
        RETRY WITH DIFFERENT SETTINGS
      </button>
    </div>
  )
}

export default RecoveryResult
