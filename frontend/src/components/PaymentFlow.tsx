import React, { useState } from 'react'
import { getDecodedToken } from '@cashu/cashu-ts'
import type { PaymentRequired } from '@/lib/types'
import clsx from 'clsx'

interface PaymentFlowProps {
  paymentRequired: PaymentRequired
  onPayWithToken: (token: string) => void
  onCancel: () => void
  isPaying: boolean
}

export default function PaymentFlow({
  paymentRequired,
  onPayWithToken,
  onCancel,
  isPaying,
}: PaymentFlowProps) {
  const [activeOption, setActiveOption] = useState<'token' | 'lightning'>('token')
  const [tokenValue, setTokenValue] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  function validateAndPay() {
    setValidationError(null)

    let decoded: ReturnType<typeof getDecodedToken>
    try {
      decoded = getDecodedToken(tokenValue.trim())
    } catch {
      setValidationError('Invalid cashu token. Please check and try again.')
      return
    }

    if (paymentRequired.mints.length > 0 && !paymentRequired.mints.includes(decoded.mint)) {
      setValidationError(
        `Token must be from an accepted mint: ${paymentRequired.mints.join(', ')}`,
      )
      return
    }

    if (decoded.unit && decoded.unit !== paymentRequired.unit) {
      setValidationError(`Token unit must be '${paymentRequired.unit}'`)
      return
    }

    const total = decoded.proofs.reduce((sum: number, p: { amount: number }) => sum + p.amount, 0)
    if (total < paymentRequired.amount) {
      setValidationError(
        `Token amount (${total} ${paymentRequired.unit}) is less than required (${paymentRequired.amount} ${paymentRequired.unit})`,
      )
      return
    }

    onPayWithToken(tokenValue.trim())
  }

  return (
    <div className="rounded-lg border border-amber-700 bg-amber-950 p-6">
      <div className="mb-4">
        <span className="font-ibm-plex-mono text-[13px] tracking-[-0.02em] text-amber-400">
          PAYMENT REQUIRED
        </span>
      </div>

      <div className="mb-5">
        <p className="karla-bold text-3xl text-zinc-100">
          {paymentRequired.amount}{' '}
          <span className="text-xl font-normal text-zinc-400">{paymentRequired.unit}</span>
        </p>
        <p className="mt-1 font-ibm-plex-mono text-xs text-amber-300">{paymentRequired.message}</p>
      </div>

      {/* Payment option buttons */}
      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setActiveOption('token')}
          className={clsx(
            'flex-1 rounded border px-3 py-2 font-ibm-plex-mono text-xs tracking-[-0.02em] transition',
            activeOption === 'token'
              ? 'border-amber-500 bg-amber-900 text-amber-300'
              : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600',
          )}
        >
          PASTE CASHU TOKEN
        </button>
        <button
          type="button"
          disabled
          title="Coming soon"
          className="flex-1 rounded cursor-not-allowed border border-zinc-800 bg-zinc-900 px-3 py-2 font-ibm-plex-mono text-xs tracking-[-0.02em] text-zinc-600"
        >
          PAY WITH LIGHTNING
        </button>
      </div>

      {activeOption === 'token' && (
        <div className="mb-4">
          <textarea
            value={tokenValue}
            onChange={(e) => {
              setTokenValue(e.target.value)
              setValidationError(null)
            }}
            placeholder="Paste your cashu token here (cashuB…)"
            rows={4}
            className="w-full resize-none rounded border border-zinc-700 bg-zinc-800 p-3 font-ibm-plex-mono text-xs text-zinc-100 placeholder-zinc-600 focus:border-amber-500 focus:outline-none"
          />
          {validationError && (
            <p className="mt-1 font-ibm-plex-mono text-xs text-red-400">{validationError}</p>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={validateAndPay}
          disabled={isPaying || !tokenValue.trim()}
          className="flex-1 rounded bg-zinc-100 px-4 py-3 font-ibm-plex-mono text-sm font-semibold text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPaying ? 'PAYING…' : 'PAY'}
        </button>
        <button
          onClick={onCancel}
          disabled={isPaying}
          className="flex-1 rounded border border-zinc-700 px-4 py-3 font-ibm-plex-mono text-sm text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-50"
        >
          CANCEL
        </button>
      </div>
    </div>
  )
}
