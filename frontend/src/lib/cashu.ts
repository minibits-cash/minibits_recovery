import { OutputData } from '@cashu/cashu-ts'
import type { MintKeys, OutputBatch, SerializedOutput } from './types'

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Generates deterministic blinded messages (OutputData) from a seed for a range of counters,
 * grouped into batches of `batchSize`. Each batch targets one call to the mint's /v1/recovery.
 *
 * The browser calls this so the seed never leaves the client.
 */
export function generateOutputBatches(
  seed: Uint8Array,
  keyset: MintKeys,
  startCounter: number,
  numBatches: number,
  batchSize: number,
): OutputBatch[] {
  const batches: OutputBatch[] = []
  const zeros = Array(batchSize).fill(0)

  // Reconstruct a HasKeysetKeys-compatible object
  const keysetObj = {
    id: keyset.id,
    keys: Object.fromEntries(
      Object.entries(keyset.keys).map(([amount, pubkey]) => [Number(amount), pubkey]),
    ) as Record<number, string>,
  }

  for (let b = 0; b < numBatches; b++) {
    const counter = startCounter + b * batchSize
    let outputDataList: OutputData[]
    try {
      outputDataList = OutputData.createDeterministicData(0, seed, counter, keysetObj, zeros)
    } catch {
      // If a blinding factor is out of range for any slot, skip that batch
      continue
    }

    const outputs: SerializedOutput[] = outputDataList.map((od) => ({
      blindedMessage: od.blindedMessage,
      blindingFactor: od.blindingFactor.toString(16).padStart(64, '0'),
      secret: bytesToHex(od.secret),
    }))

    batches.push({ counter, outputs })
  }

  return batches
}
