import { secp256k1 } from '@noble/curves/secp256k1.js'
import { getEncodedTokenV4, hashToCurve, ProofState } from '@cashu/cashu-ts'
import type { RecoveryRequest, JobResult, SerializedOutput } from '../types/index'
import { log } from './logService'
import AppError, { Err } from '../utils/AppError'
import * as ippon from './ipponService'

interface SerializedBlindedSignature {
  id: string
  amount: number
  C_: string
}

interface Proof {
  id: string
  amount: number
  secret: string
  C: string
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

// Unblind a mint signature: C = C_ - r*A
function unblindSignature(C_hex: string, blindingFactorHex: string, mintPubkeyHex: string): string {
  const C_ = secp256k1.Point.fromHex(C_hex)
  const A = secp256k1.Point.fromHex(mintPubkeyHex)
  const r = BigInt('0x' + blindingFactorHex)
  const C = C_.subtract(A.multiply(r))
  return C.toHex(true) // compressed
}

function constructProof(
  output: SerializedOutput,
  sig: SerializedBlindedSignature,
  mintPubkeyHex: string,
): Proof {
  const C = unblindSignature(sig.C_, output.blindingFactor, mintPubkeyHex)
  const secretStr = new TextDecoder().decode(hexToBytes(output.secret))
  return { id: sig.id, amount: sig.amount, secret: secretStr, C }
}

async function mintRecovery(
  mintUrl: string,
  outputs: Array<{ amount: number; B_: string; id: string }>,
): Promise<{ outputs: typeof outputs; signatures: SerializedBlindedSignature[] }> {
  log.debug('[mintRecovery] Calling mint /v1/restore', { mintUrl, count: outputs.length })
  const res = await fetch(`${mintUrl}/v1/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ outputs }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new AppError(502, Err.CONNECTION_ERROR, `Mint recovery error ${res.status}: ${body}`, {
      caller: 'mintRecovery',
      mintUrl,
    })
  }
  return res.json()
}

async function checkProofStates(mintUrl: string, proofs: Proof[]): Promise<Proof[]> {
  if (proofs.length === 0) return []
  const batchSize = parseInt(process.env.MAX_BATCH_SIZE || '100')
  log.debug('[checkProofStates] Checking proof states', { mintUrl, count: proofs.length, batchSize })

  const enc = new TextEncoder()
  // Pre-compute Y = hash_to_curve(secret) per NUT-07 for every proof
  const proofYs = proofs.map((p) => hashToCurve(enc.encode(p.secret)).toHex(true))

  // Collect Y → state across all batches; missing Ys simply won't appear (treated as spent)
  const stateMap = new Map<string, string>()
  for (let i = 0; i < proofYs.length; i += batchSize) {
    const YsSlice = proofYs.slice(i, i + batchSize)
    const res = await fetch(`${mintUrl}/v1/checkstate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Ys: YsSlice }),
    })
    if (!res.ok) {
      const body = await res.text()
      throw new AppError(502, Err.CONNECTION_ERROR, `Mint checkstate error ${res.status}: ${body}`, {
        caller: 'checkProofStates',
        mintUrl,
      })
    }
    const { states: batchStates } = await res.json() as { states: ProofState[] }
    for (const s of batchStates) {
      stateMap.set(s.Y, s.state)
    }
  }

  const unspent = proofs.filter((_, idx) => stateMap.get(proofYs[idx]) === 'UNSPENT')
  log.info('[checkProofStates] Unspent proofs found', { total: proofs.length, unspent: unspent.length })
  return unspent
}

export async function runRecovery(req: RecoveryRequest, jobId: string): Promise<JobResult> {
  const { mintUrl, keyset, batches, gapLimit = 300, batchSize = 100 } = req
  const requiredEmptyBatches = Math.ceil(gapLimit / batchSize)

  log.info('[runRecovery] Starting recovery', {
    jobId,
    mintUrl,
    keysetId: keyset.id,
    batches: batches.length,
    gapLimit,
    batchSize,
    requiredEmptyBatches,
  })

  const allRecoveredProofs: Proof[] = []
  let lastCounter = batches[0]?.counter ?? 0
  let emptyBatchesFound = 0
  let exhausted = false

  for (const batch of batches) {
    const blindedMessages = batch.outputs.map((o) => o.blindedMessage)
    const { outputs: matchedOutputs, signatures } = await mintRecovery(mintUrl, blindedMessages)

    if (matchedOutputs.length === 0 || signatures.length === 0) {
      emptyBatchesFound++
      log.trace('[runRecovery] Empty batch', { jobId, counter: batch.counter, emptyBatchesFound, requiredEmptyBatches })
      if (emptyBatchesFound >= requiredEmptyBatches) {
        log.info('[runRecovery] Gap limit reached, stopping', { jobId, counter: batch.counter, emptyBatchesFound })
        break
      }
      continue
    }

    // Build lookup: B_ → signature
    const sigMap = new Map<string, SerializedBlindedSignature>()
    for (let i = 0; i < matchedOutputs.length; i++) {
      sigMap.set(matchedOutputs[i].B_, signatures[i])
    }

    let batchHadSignature = false
    for (let i = 0; i < batch.outputs.length; i++) {
      const output = batch.outputs[i]
      const sig = sigMap.get(output.blindedMessage.B_)
      if (sig) {
        const mintPubkey = keyset.keys[sig.amount.toString()]
        if (!mintPubkey) {
          throw new AppError(
            500,
            Err.SERVER_ERROR,
            `No mint pubkey for amount ${sig.amount}`,
            { caller: 'runRecovery', keysetId: keyset.id, amount: sig.amount },
          )
        }
        const proof = constructProof(output, sig, mintPubkey)
        allRecoveredProofs.push(proof)
        lastCounter = batch.counter + i
        batchHadSignature = true
      }
    }

    if (batchHadSignature) {
      emptyBatchesFound = 0
      log.debug('[runRecovery] Signatures found in batch', {
        jobId,
        counter: batch.counter,
        batchProofs: sigMap.size,
        totalProofs: allRecoveredProofs.length,
      })
    } else {
      emptyBatchesFound++
      if (emptyBatchesFound >= requiredEmptyBatches) {
        log.info('[runRecovery] Gap limit reached, stopping', { jobId, counter: batch.counter, emptyBatchesFound })
        break
      }
    }
  }

  // Check if all provided batches were consumed without hitting gap limit
  if (emptyBatchesFound < requiredEmptyBatches && batches.length > 0) {
    exhausted = true
    log.warn('[runRecovery] All batches exhausted before gap limit — more proofs may exist', {
      jobId,
      lastCounter,
      batches: batches.length,
    })
  }

  // Filter to unspent proofs only
  const unspentProofs = await checkProofStates(mintUrl, allRecoveredProofs)

  if (unspentProofs.length === 0) {
    log.info('[runRecovery] No unspent proofs found', { jobId, lastCounter, exhausted })
    return { proofs: 0, balance: 0, lastCounter, accessKey: '', walletName: '', exhausted }
  }

  // Create ippon wallet and fund it with recovered proofs
  const wallet = await ippon.createWallet(`minibits-recovery-${jobId}`)
  log.info('[runRecovery] Ippon wallet created', { jobId, walletName: wallet.name })

  const token = getEncodedTokenV4({
    mint: mintUrl,
    proofs: unspentProofs.map((p) => ({
      id: p.id,
      amount: p.amount,
      secret: p.secret,
      C: p.C,
    })),
  })

  const { balance } = await ippon.receiveToken(wallet.access_key, token)
  log.info('[runRecovery] Token received into ippon wallet', { jobId, walletName: wallet.name, balance })

  return {
    proofs: unspentProofs.length,
    balance,
    lastCounter,
    accessKey: wallet.access_key,
    walletName: wallet.name,
    exhausted,
  }
}
