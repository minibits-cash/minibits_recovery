import React, { useState } from 'react'
import { isValidMnemonic, getWordCount } from '@/lib/mnemonic'
import clsx from 'clsx'

interface SeedInputProps {
  value: string
  onChange: (value: string) => void
}

const SeedInput = ({ value, onChange }: SeedInputProps) => {
  const [touched, setTouched] = useState(false)
  const [hidden, setHidden] = useState(false)

  const wordCount = getWordCount(value)
  const isValid = isValidMnemonic(value)
  const showValidation = touched && value.length > 0
  const borderClass = showValidation && isValid
    ? 'border-green-400'
    : showValidation && !isValid && wordCount >= 12
      ? 'border-red-400'
      : 'border-gray-300'

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="ibm-plex-mono-medium text-[13px] tracking-[-0.02em] text-[#6B7280]">
          SEED PHRASE
        </h3>
        <div className="flex items-center gap-3">
          {value.length > 0 && (
            <span
              className={clsx(
                'font-ibm-plex-mono text-xs',
                showValidation && isValid
                  ? 'text-green-600'
                  : showValidation && !isValid && wordCount >= 12
                    ? 'text-red-500'
                    : 'text-gray-400',
              )}
            >
              {wordCount} word{wordCount !== 1 ? 's' : ''}
              {showValidation && isValid && ' ✓'}
              {showValidation && !isValid && wordCount >= 12 && ' ✗'}
            </span>
          )}
          {value.length > 0 && (
            <button
              type="button"
              onClick={() => setHidden((h) => !h)}
              className="font-ibm-plex-mono text-xs text-gray-400 underline"
            >
              {hidden ? 'SHOW' : 'HIDE'}
            </button>
          )}
        </div>
      </div>

      {hidden ? (
        <div
          className={clsx(
            'w-full rounded border bg-white p-3 font-ibm-plex-mono text-sm text-gray-400 select-none',
            borderClass,
          )}
          style={{ minHeight: '6rem' }}
        >
          {value.replace(/[^\s]/g, '•')}
        </div>
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder="Enter your 12 word Cashu wallet seed phrase…"
          rows={4}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className={clsx(
            'w-full resize-none rounded border bg-white p-3 font-ibm-plex-mono text-sm text-gray-900 placeholder-gray-400 focus:outline-none',
            showValidation && isValid
              ? 'border-green-400 focus:border-green-500'
              : showValidation && !isValid && wordCount >= 12
                ? 'border-red-400 focus:border-red-500'
                : 'border-gray-300 focus:border-[#f18805]',
          )}
        />
      )}

      {showValidation && !isValid && wordCount > 0 && (
        <p className="mt-1 font-ibm-plex-mono text-xs text-red-500">
          {wordCount < 12
            ? `${12 - wordCount} more word${12 - wordCount !== 1 ? 's' : ''} needed (minimum 12)`
            : 'Invalid seed phrase. Check spelling or word order.'}
        </p>
      )}

      <p className="mt-2 font-ibm-plex-mono text-xs text-gray-400">
        Your seed phrase is used to pre-generate blinded messages and is never sent to the server.
      </p>
    </div>
  )
}

export default SeedInput
