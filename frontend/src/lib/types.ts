export type JobStatus = 'IN_PROGRESS' | 'COMPLETED' | 'ERROR'

export interface SerializedBlindedMessage {
  amount: number
  B_: string
  id: string
}

export interface SerializedOutput {
  blindedMessage: SerializedBlindedMessage
  blindingFactor: string // bigint serialized as hex
  secret: string        // Uint8Array serialized as hex
}

export interface OutputBatch {
  counter: number
  outputs: SerializedOutput[]
}

export interface MintKeyset {
  id: string
  unit: string
  active: boolean
  input_fee_ppk?: number
}

export interface MintKeys {
  id: string
  unit: string
  keys: Record<string, string> // amount → pubkey hex
}

export interface MintInfo {
  name: string
  pubkey?: string
  version?: string
  description?: string
  description_long?: string
  contact?: Array<{ method: string; info: string }>
  icon_url?: string
  motd?: string
}

export interface RecoveryRequest {
  mintUrl: string
  keysetId: string
  keyset: MintKeys
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

export interface PaymentRequired {
  encodedRequest: string
  message: string
  amount: number
  unit: string
  mints: string[]
}

export interface PollResponse {
  status: JobStatus
  result?: JobResult
  error?: string
}

export interface RecoveryAttempt {
  id: string
  mintUrl: string
  keysetId: string
  startCounter: number
  jobId: string
  status: JobStatus
  result?: JobResult
  error?: string
  startedAt: number
}
