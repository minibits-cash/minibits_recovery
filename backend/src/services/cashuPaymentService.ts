import { Wallet, getDecodedToken, getEncodedTokenV4 } from '@cashu/cashu-ts'
import { receiveToken } from './ipponService'
import { log } from './logService'
import AppError, { Err } from '../utils/AppError'

const PAYMENT_AMOUNT = parseInt(process.env.PAYMENT_AMOUNT_SAT || '100')
const PAYMENT_UNIT = 'sat'
const COLLECTION_MINT = process.env.PAYMENT_COLLECTION_MINT?.trim() ?? ''
const FEE_RESERVE_PERCENT = 0.05

/**
 * Collect a payment token into the collection wallet.
 *
 * If the token's mint matches PAYMENT_COLLECTION_MINT, the token is deposited
 * directly via the Ippon wallet API. Otherwise an inter-mint Lightning exchange
 * is performed: melt at the source mint, mint at the collection mint.
 */
export async function collectPayment(cashuHeader: string): Promise<void> {
  const collectionKey = process.env.PAYMENT_COLLECTION_ACCESS_KEY?.trim()

  if (!collectionKey) {
    log.warn('[collectPayment] PAYMENT_COLLECTION_ACCESS_KEY not configured — skipping deposit')
    log.warn('[collectPayment]', cashuHeader)
    return
  }

  if (!COLLECTION_MINT) {
    log.warn('[collectPayment] PAYMENT_COLLECTION_MINT not configured — depositing directly via Ippon')
    const { balance } = await receiveToken(collectionKey, cashuHeader)
    log.info('[collectPayment] Direct deposit complete', { balance })
    return
  }

  const decoded = getDecodedToken(cashuHeader)

  if (decoded.mint === COLLECTION_MINT) {
    log.debug('[collectPayment] Same mint — direct deposit via Ippon', { mint: decoded.mint })
    const { balance } = await receiveToken(collectionKey, cashuHeader)
    log.info('[collectPayment] Direct deposit complete', { balance })
    return
  }

  log.info('[collectPayment] Different mint — starting inter-mint Lightning exchange', {
    sourceMint: decoded.mint,
    collectionMint: COLLECTION_MINT,
  })
  
  await interMintExchange(decoded.mint, decoded.proofs, collectionKey)
}

async function interMintExchange(
  sourceMintUrl: string,
  proofs: Array<{ id: string; amount: number; secret: string; C: string }>,
  collectionKey: string,
): Promise<void> {
  // Amount to mint at the collection side — reduced by fee reserve for Lightning routing
  const mintAmount = Math.floor(PAYMENT_AMOUNT * (1 - FEE_RESERVE_PERCENT))

  // Step 1: Request a mint quote (bolt11 invoice) from the collection mint
  const collectionWallet = new Wallet(COLLECTION_MINT, { unit: PAYMENT_UNIT })
  await collectionWallet.loadMint()
  const mintQuote = await collectionWallet.createMintQuote(mintAmount)
  log.debug('[interMintExchange] Mint quote created', {
    mintAmount,
    quote: mintQuote.quote,
    invoice: mintQuote.request,
  })

  // Step 2: Request a melt quote from the source mint to pay the invoice above
  const sourceWallet = new Wallet(sourceMintUrl, { unit: PAYMENT_UNIT })
  await sourceWallet.loadMint()
  const meltQuote = await sourceWallet.createMeltQuote(mintQuote.request)
  log.debug('[interMintExchange] Melt quote created', {
    amount: meltQuote.amount,
    feeReserve: meltQuote.fee_reserve,
  })

  // Verify the provided proofs are sufficient to cover melt amount + routing fee reserve
  const proofsTotal = proofs.reduce((sum, p) => sum + p.amount, 0)
  const needed = meltQuote.amount + meltQuote.fee_reserve
  if (proofsTotal < needed) {
    throw new AppError(
      400,
      Err.VALIDATION_ERROR,
      `Insufficient proofs for inter-mint exchange: have ${proofsTotal} sat, need ${needed} sat (${meltQuote.amount} + ${meltQuote.fee_reserve} fee reserve)`,
      { caller: 'interMintExchange', sourceMintUrl, proofsTotal, needed },
    )
  }

  // Step 3: Melt proofs at the source mint — pays the bolt11 invoice
  const meltResult = await sourceWallet.meltProofs(meltQuote, proofs)
  if (meltResult.quote.state !== 'PAID') {
    throw new AppError(
      502,
      Err.CONNECTION_ERROR,
      `Lightning payment failed during inter-mint exchange (state: ${meltResult.quote.state})`,
      { caller: 'interMintExchange', quote: meltQuote.quote },
    )
  }
  log.info('[interMintExchange] Lightning payment successful', { quote: mintQuote.quote })

  // Step 4: Mint new proofs at the collection mint and deposit them into the Ippon wallet.
  // Best-effort: if this step fails the Lightning invoice was already paid, so we log the
  // mint quote for manual recovery rather than blocking the request.
  try {
    const newProofs = await collectionWallet.mintProofs(mintAmount, mintQuote)
    const newToken = getEncodedTokenV4({ mint: COLLECTION_MINT, proofs: newProofs })
    const { balance } = await receiveToken(collectionKey, newToken)
    log.info('[interMintExchange] Inter-mint exchange complete', { mintAmount, balance })
  } catch (err) {
    log.error('[interMintExchange] Failed to collect at collection mint — manual recovery needed', {
      mintQuote: mintQuote.quote,
      collectionMint: COLLECTION_MINT,
      error: (err as Error).message,
    })
    // Do not rethrow — the Lightning payment succeeded, so the payer's request is authorised
  }
}
