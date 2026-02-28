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
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 shadow-sm">
      <div className="mb-4">
        <span className="font-ibm-plex-mono text-[13px] tracking-[-0.02em] text-amber-700">
          PAYMENT REQUIRED
        </span>
      </div>

      <div className="mb-5">
        <p className="karla-bold text-3xl text-gray-900">
          {paymentRequired.amount}{' '}
          <span className="text-xl font-normal text-gray-600">{paymentRequired.unit}</span>
        </p>
        <p className="mt-1 font-ibm-plex-mono text-xs text-amber-800">{paymentRequired.message}</p>
      </div>

      {/* Payment option buttons */}
      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setActiveOption('token')}
          className={clsx(
            'flex-1 rounded border px-3 py-2 font-ibm-plex-mono text-xs tracking-[-0.02em] transition',
            activeOption === 'token'
              ? 'border-amber-500 bg-amber-100 text-amber-800'
              : 'border-gray-300 bg-white text-gray-500 hover:border-gray-400',
          )}
        >
          PASTE CASHU TOKEN
        </button>
        <button
          type="button"
          disabled
          title="Coming soon"
          className="flex-1 rounded cursor-not-allowed border border-gray-200 bg-gray-50 px-3 py-2 font-ibm-plex-mono text-xs tracking-[-0.02em] text-gray-400"
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
            className="w-full resize-none rounded border border-gray-300 bg-white p-3 font-ibm-plex-mono text-xs text-gray-800 placeholder-gray-400 focus:border-amber-400 focus:outline-none"
          />
          {validationError && (
            <p className="mt-1 font-ibm-plex-mono text-xs text-red-500">{validationError}</p>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={validateAndPay}
          disabled={isPaying || !tokenValue.trim()}
          className="flex-1 rounded bg-black px-4 py-3 font-ibm-plex-mono text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPaying ? 'PAYING…' : 'PAY'}
        </button>
        <button
          onClick={onCancel}
          disabled={isPaying}
          className="flex-1 rounded border border-gray-300 px-4 py-3 font-ibm-plex-mono text-sm text-gray-600 transition hover:border-gray-400 hover:text-gray-800 disabled:opacity-50"
        >
          CANCEL
        </button>
      </div>
    </div>
  )
}
