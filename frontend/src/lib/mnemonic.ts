import { validateMnemonic, mnemonicToSeedSync } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english'

export function isValidMnemonic(phrase: string): boolean {
  const trimmed = phrase.trim()
  if (!trimmed) return false
  return validateMnemonic(trimmed, wordlist)
}

export function getWordCount(phrase: string): number {
  return phrase.trim().split(/\s+/).filter(Boolean).length
}

export function mnemonicToSeed(phrase: string): Uint8Array {
  return mnemonicToSeedSync(phrase.trim())
}
