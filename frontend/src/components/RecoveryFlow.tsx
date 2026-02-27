import React, { useState, useCallback, useRef } from 'react'
import { useInView } from 'react-intersection-observer'
import { v4 as uuidv4 } from 'uuid'
import MintCard from './MintCard'
import KeysetSelect from './KeysetSelect'
import SeedInput from './SeedInput'
import RecoveryProgress from './RecoveryProgress'
import RecoveryResult from './RecoveryResult'
import PaymentFlow from './PaymentFlow'
import { isValidMnemonic, mnemonicToSeed } from '@/lib/mnemonic'
import { generateOutputBatches } from '@/lib/cashu'
import { startRecovery } from '@/lib/api'
import type { MintKeys, RecoveryAttempt, PollResponse, PaymentRequired, RecoveryRequest } from '@/lib/types'
import clsx from 'clsx'

const DEFAULT_MINT = process.env.NEXT_PUBLIC_DEFAULT_MINT ?? 'https://mint.minibits.cash/Bitcoin'
const DEFAULT_BATCH_SIZE = parseInt(process.env.NEXT_PUBLIC_DEFAULT_BATCH_SIZE ?? '100')
const DEFAULT_GAP_LIMIT = parseInt(process.env.NEXT_PUBLIC_DEFAULT_GAP_LIMIT ?? '300')

// Number of batches to generate per recovery run
// ceil(gapLimit / batchSize) + safety buffer covers the full gap scan
const NUM_BATCHES = parseInt(process.env.NEXT_PUBLIC_NUM_BATCHES ?? '25')

export default function RecoveryFlow() {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.05 })

  // Form state
  const [mintUrl, setMintUrl] = useState(DEFAULT_MINT)
  const [selectedKeyset, setSelectedKeyset] = useState<MintKeys | null>(null)
  const [seed, setSeed] = useState('')
  const [startCounter, setStartCounter] = useState(0)

  // Active job
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [activeAttempt, setActiveAttempt] = useState<RecoveryAttempt | null>(null)

  // Payment flow
  const [paymentRequired, setPaymentRequired] = useState<PaymentRequired | null>(null)
  const [pendingRequest, setPendingRequest] = useState<RecoveryRequest | null>(null)
  const [isPaying, setIsPaying] = useState(false)

  // History of completed attempts, newest first
  const [attempts, setAttempts] = useState<RecoveryAttempt[]>([])

  // Error/status
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Ref-based mutex — prevents double-submits in the window before the first re-render disables the button
  const isSubmittingRef = useRef(false)

  const canSubmit =
    !!selectedKeyset && isValidMnemonic(seed) && !activeJobId && !paymentRequired

  async function handleStartRecovery() {
    if (!selectedKeyset || !isValidMnemonic(seed)) return
    if (isSubmittingRef.current) return
    isSubmittingRef.current = true

    setSubmitError(null)
    setIsGenerating(true)

    // Yield to the browser so React can flush the state update and paint the
    // spinner before the CPU-intensive batch generation blocks the main thread.
    await new Promise<void>((resolve) => setTimeout(resolve, 0))

    let jobId: string
    const attemptId = uuidv4()

    try {
      // Generate deterministic output data in the browser (seed stays local)
      const seedBytes = mnemonicToSeed(seed)
      const batches = generateOutputBatches(
        seedBytes,
        selectedKeyset,
        startCounter,
        NUM_BATCHES,
        DEFAULT_BATCH_SIZE,
      )

      if (batches.length === 0) {
        throw new Error('Failed to generate output batches. Check keyset or counter value.')
      }

      const recoveryRequest: RecoveryRequest = {
        mintUrl,
        keysetId: selectedKeyset.id,
        keyset: selectedKeyset,
        batches,
        gapLimit: DEFAULT_GAP_LIMIT,
        batchSize: DEFAULT_BATCH_SIZE,
      }

      // Submit to server
      const result = await startRecovery(recoveryRequest)

      if (result.kind === 'payment_required') {
        setPendingRequest(recoveryRequest)
        setPaymentRequired(result.paymentRequired)
        setIsGenerating(false)
        isSubmittingRef.current = false
        return
      }

      jobId = result.jobId
    } catch (e) {
      setSubmitError((e as Error).message)
      setIsGenerating(false)
      isSubmittingRef.current = false
      return
    }

    setIsGenerating(false)
    isSubmittingRef.current = false

    const attempt: RecoveryAttempt = {
      id: attemptId,
      mintUrl,
      keysetId: selectedKeyset.id,
      unit: selectedKeyset.unit,
      startCounter,
      jobId,
      status: 'IN_PROGRESS',
      startedAt: Date.now(),
    }
    setActiveAttempt(attempt)
    setActiveJobId(jobId)
  }

  async function handlePayWithToken(cashuToken: string) {
    if (!pendingRequest) return
    setIsPaying(true)
    setSubmitError(null)

    let jobId: string
    const attemptId = uuidv4()

    try {
      const result = await startRecovery(pendingRequest, cashuToken)

      if (result.kind === 'payment_required') {
        // Token was rejected at the server level — refresh payment info
        setPaymentRequired(result.paymentRequired)
        setIsPaying(false)
        return
      }

      jobId = result.jobId
    } catch (e) {
      setSubmitError((e as Error).message)
      setIsPaying(false)
      return
    }

    setPaymentRequired(null)
    setPendingRequest(null)
    setIsPaying(false)

    const attempt: RecoveryAttempt = {
      id: attemptId,
      mintUrl: pendingRequest.mintUrl,
      keysetId: pendingRequest.keysetId,
      unit: pendingRequest.keyset.unit,
      startCounter,
      jobId,
      status: 'IN_PROGRESS',
      startedAt: Date.now(),
    }
    setActiveAttempt(attempt)
    setActiveJobId(jobId)
  }

  function handleCancelPayment() {
    setPaymentRequired(null)
    setPendingRequest(null)
  }

  const handleJobComplete = useCallback(
    (pollResult: PollResponse) => {
      if (!activeAttempt) return

      const completed: RecoveryAttempt = {
        ...activeAttempt,
        status: pollResult.status,
        result: pollResult.result,
        error: pollResult.error,
      }

      setAttempts((prev) => [completed, ...prev])
      setActiveJobId(null)
      setActiveAttempt(null)

      // If recovered something, advance start counter for next attempt
      if (pollResult.result && pollResult.result.scannedToCounter > startCounter) {
        setStartCounter(pollResult.result.scannedToCounter + 1)
      }
    },
    [activeAttempt, startCounter],
  )

  function handleRetry() {
    setActiveJobId(null)
    setActiveAttempt(null)
    setShowAdvanced(true)
  }

  return (
    <div className="mb-32 mt-8">
      <div
        ref={ref}
        className={clsx(
          'mx-auto max-w-[1152px] px-8 transition-all duration-1000 ease-out xl:px-0',
          inView ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0',
        )}
      >
        {/* Section header */}
        {/*<h2 className="ibm-plex-mono-medium mb-2 text-[18px] tracking-[-0.02em] text-[#6B7280]">
          RECOVERY
        </h2>
        <p className="karla-regular mb-8 max-w-2xl text-[21px] text-gray-900">
          Configure your recovery settings, enter your seed phrase, and we&apos;ll scan the mint for
          your ecash proofs.
        </p>*/}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left: Form */}
          <div className="flex flex-col gap-6">
            {/* 1. Mint */}
            <MintCard mintUrl={mintUrl} onMintUrlChange={setMintUrl} />

            {/* 3. Seed */}
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <SeedInput value={seed} onChange={setSeed} />
            </div>

            {/* Advanced section: Keyset + Counter */}
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="flex w-full items-center justify-between px-6 py-4 font-ibm-plex-mono text-[13px] tracking-[-0.02em] text-[#6B7280]"
              >
                <span>ADVANCED</span>
                <span className="text-gray-400">{showAdvanced ? '▲' : '▼'}</span>
              </button>

              {/* Always mounted so it fetches + auto-selects on load; hidden until Advanced is opened */}
              <div className={showAdvanced ? 'flex flex-col gap-4 border-t border-gray-100 px-6 pb-6 pt-4' : 'hidden'}>
                  <KeysetSelect
                    mintUrl={mintUrl}
                    selectedKeysetId={selectedKeyset?.id ?? null}
                    onKeysetChange={setSelectedKeyset}
                  />

                  <div>
                    <h3 className="ibm-plex-mono-medium mb-2 text-[13px] tracking-[-0.02em] text-[#6B7280]">
                      STARTING COUNTER
                    </h3>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min={0}
                        step={DEFAULT_BATCH_SIZE}
                        value={startCounter}
                        onChange={(e) => setStartCounter(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-32 rounded border border-gray-300 px-3 py-2 font-ibm-plex-mono text-sm text-gray-900 focus:border-[#f18805] focus:outline-none"
                      />
                      {startCounter > 0 && (
                        <button
                          onClick={() => setStartCounter(0)}
                          className="font-ibm-plex-mono text-xs text-gray-400 underline"
                        >
                          reset to 0
                        </button>
                      )}
                    </div>
                    <p className="mt-1 font-ibm-plex-mono text-xs text-gray-400">
                      Start scanning from this counter value. Use 0 for a fresh recovery.
                    </p>
                  </div>
                </div>
            </div>

            {/* Submit */}
            {submitError && (
              <p className="font-ibm-plex-mono text-sm text-red-500">{submitError}</p>
            )}

            <button
              onClick={handleStartRecovery}
              disabled={!canSubmit || isGenerating}
              className="flex w-full items-center justify-center gap-3 bg-black px-6 py-4 font-ibm-plex-mono text-base font-semibold text-white transition duration-300 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isGenerating && (
                <svg
                  className="h-4 w-4 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {isGenerating ? 'GENERATING DATA…' : 'START RECOVERY'}
            </button>

            {!selectedKeyset && (
              <p className="font-ibm-plex-mono text-xs text-gray-400">
                Select a mint and keyset above to enable recovery.
              </p>
            )}
          </div>

          {/* Right: Progress / Results */}
          <div className="flex flex-col gap-6">
            {/* Payment flow (shown when 402 is returned) */}
            {paymentRequired && (
              <PaymentFlow
                paymentRequired={paymentRequired}
                onPayWithToken={handlePayWithToken}
                onCancel={handleCancelPayment}
                isPaying={isPaying}
              />
            )}

            {/* Active job progress */}
            {activeJobId && activeAttempt && (
              <RecoveryProgress
                jobId={activeJobId}
                mintUrl={mintUrl}
                onComplete={handleJobComplete}
              />
            )}

            {/* Historical results, newest first */}
            {attempts.length === 0 && !activeJobId && !paymentRequired && (
              <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-gray-200">
                <p className="font-ibm-plex-mono text-sm text-gray-400">
                  Recovery results will appear here
                </p>
              </div>
            )}

            {attempts.map((attempt) => (
              <RecoveryResult key={attempt.id} attempt={attempt} onRetry={handleRetry} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
