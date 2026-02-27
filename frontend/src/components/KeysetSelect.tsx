import React, { useEffect, useState } from 'react'
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react'
import type { MintKeyset, MintKeys } from '@/lib/types'
import clsx from 'clsx'

interface KeysetSelectProps {
  mintUrl: string
  selectedKeysetId: string | null
  onKeysetChange: (keys: MintKeys) => void
}

const KeysetSelect = ({ mintUrl, selectedKeysetId, onKeysetChange }: KeysetSelectProps) => {
  const [keysets, setKeysets] = useState<MintKeyset[]>([])
  const [allKeys, setAllKeys] = useState<MintKeys[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!mintUrl) return
    fetchKeysets(mintUrl)
  }, [mintUrl])

  async function fetchKeysets(url: string) {
    setLoading(true)
    setError(null)
    try {
      const [keysetsRes, keysRes] = await Promise.all([
        fetch(`${url}/v1/keysets`),
        fetch(`${url}/v1/keys`),
      ])
      if (!keysetsRes.ok || !keysRes.ok) throw new Error('Failed to load keysets')

      const keysetsData: { keysets: MintKeyset[] } = await keysetsRes.json()
      const keysData: { keysets: MintKeys[] } = await keysRes.json()

      setKeysets(keysetsData.keysets)
      setAllKeys(keysData.keysets)

      // Auto-select first active keyset
      const firstActive = keysetsData.keysets.find((k) => k.active)
      if (firstActive) {
        const keysForActive = keysData.keysets.find((k) => k.id === firstActive.id)
        if (keysForActive) onKeysetChange(keysForActive)
      }
    } catch (e) {
      setError('Could not load keysets from mint.')
    } finally {
      setLoading(false)
    }
  }

  const selectedKeyset = keysets.find((k) => k.id === selectedKeysetId) ?? undefined

  function handleSelect(keyset: MintKeyset) {
    const keys = allKeys.find((k) => k.id === keyset.id)
    if (keys) onKeysetChange(keys)
  }

  if (loading)
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-[#f18805]" />
        Loading keysets…
      </div>
    )

  if (error) return <p className="text-sm text-red-500">{error}</p>

  if (keysets.length === 0) return null

  return (
    <div>
      <h3 className="ibm-plex-mono-medium mb-2 text-[13px] tracking-[-0.02em] text-[#6B7280]">
        KEYSET
      </h3>
      <Listbox value={selectedKeyset} onChange={handleSelect}>
        <div className="relative">
          <ListboxButton className="relative w-full cursor-pointer rounded border border-gray-300 bg-white py-2.5 pl-3 pr-10 text-left font-ibm-plex-mono text-sm text-gray-900 focus:border-[#f18805] focus:outline-none">
            {selectedKeyset ? (
              <span className="flex items-center gap-2">
                <span
                  className={clsx(
                    'inline-block h-2 w-2 flex-shrink-0 rounded-full',
                    selectedKeyset.active ? 'bg-green-500' : 'bg-gray-400',
                  )}
                />
                <span className="truncate">{selectedKeyset.id}</span>
                <span className="ml-1 text-gray-400">({selectedKeyset.unit})</span>
              </span>
            ) : (
              <span className="text-gray-400">Select keyset…</span>
            )}
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400">
              ▾
            </span>
          </ListboxButton>

          <ListboxOptions className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded border border-gray-200 bg-white py-1 shadow-lg focus:outline-none">
            {keysets.map((keyset) => (
              <ListboxOption
                key={keyset.id}
                value={keyset}
                className={({ focus }) =>
                  clsx(
                    'cursor-pointer select-none px-3 py-2 font-ibm-plex-mono text-sm',
                    focus ? 'bg-gray-100' : 'bg-white',
                  )
                }
              >
                <span className="flex items-center gap-2">
                  <span
                    className={clsx(
                      'inline-block h-2 w-2 flex-shrink-0 rounded-full',
                      keyset.active ? 'bg-green-500' : 'bg-gray-400',
                    )}
                  />
                  <span className="truncate">{keyset.id}</span>
                  <span className="text-gray-400">({keyset.unit})</span>
                  {!keyset.active && (
                    <span className="ml-auto text-xs text-gray-400">inactive</span>
                  )}
                </span>
              </ListboxOption>
            ))}
          </ListboxOptions>
        </div>
      </Listbox>
      {selectedKeyset && (
        <p className="mt-1 font-ibm-plex-mono text-xs text-gray-400">
          {selectedKeyset.active ? 'Active keyset' : 'Inactive keyset'} · {selectedKeyset.unit} ·{' '}
          {selectedKeyset.input_fee_ppk != null
            ? `Fee: ${selectedKeyset.input_fee_ppk} ppk`
            : 'No fee info'}
        </p>
      )}
    </div>
  )
}

export default KeysetSelect
