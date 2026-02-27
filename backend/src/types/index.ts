export type JobStatus = 'IN_PROGRESS' | 'COMPLETED' | 'ERROR'

export interface SerializedBlindedMessage {
  amount: number
  B_: string
  id: string
}

export interface SerializedOutput {
  blindedMessage: SerializedBlindedMessage
  blindingFactor: string // bigint as hex string
  secret: string // Uint8Array as hex string
}

export interface OutputBatch {
  counter: number
  outputs: SerializedOutput[]
}

export interface RecoveryRequest {
  mintUrl: string
  keysetId: string
  keyset: {
    id: string
    keys: Record<string, string> // amount -> pubkey hex
  }
  batches: OutputBatch[]
  gapLimit?: number
  batchSize?: number
}

export interface JobResult {
  proofs: number
  balance: number
  lastCounter: number
  accessKey: string
  walletName: string
  exhausted: boolean
}

export interface JobState {
  status: JobStatus
  result?: JobResult
  error?: string
  createdAt: number
  mintUrl?: string
}
