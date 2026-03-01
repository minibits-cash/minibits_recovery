import React, { useEffect, useState } from 'react'
import type { MintInfo } from '@/lib/types'

interface MintCardProps {
  mintUrl: string
  onMintUrlChange: (url: string) => void
}

const DEFAULT_MINT = process.env.NEXT_PUBLIC_DEFAULT_MINT ?? 'https://mint.minibits.cash/sat'

const MintCard = ({ mintUrl, onMintUrlChange }: MintCardProps) => {
  const [info, setInfo] = useState<MintInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inputUrl, setInputUrl] = useState(mintUrl)

  useEffect(() => {
    fetchMintInfo(mintUrl)
  }, [mintUrl])

  async function fetchMintInfo(url: string) {
    if (!url) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${url}/v1/info`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: MintInfo = await res.json()
      setInfo(data)
    } catch (e) {
      setError('Could not reach mint. Check URL.')
      setInfo(null)
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = inputUrl.trim().replace(/\/$/, '')
    onMintUrlChange(trimmed)
  }

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-6">
      {/*<h3 className="ibm-plex-mono-medium mb-4 text-[13px] tracking-[-0.02em] text-[#6B7280]">
        MINT
      </h3>*/}

      {/* URL input */}
      {/*<form onSubmit={handleSubmit} className="mb-4 flex gap-2">
        <input
          type="url"
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          placeholder={DEFAULT_MINT}
          className="flex-1 rounded border border-gray-300 px-3 py-2 font-ibm-plex-mono text-sm text-gray-900 focus:border-[#f18805] focus:outline-none"
        />
        <button
          type="submit"
          className="bg-black px-4 py-2 font-ibm-plex-mono text-sm font-semibold text-white transition hover:bg-gray-800"
        >
          SET
        </button>
        {mintUrl !== DEFAULT_MINT && (
          <button
            type="button"
            onClick={() => {
              setInputUrl(DEFAULT_MINT)
              onMintUrlChange(DEFAULT_MINT)
            }}
            className="px-3 py-2 font-ibm-plex-mono text-xs text-gray-500 underline"
          >
            reset
          </button>
        )}
      </form>*/}

      {/* Mint info display */}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-[#f18805]" />
          Loading mint info…
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      {info && !loading && (
        <div className="flex items-start gap-4">
          {info.icon_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={new URL(info.icon_url, mintUrl).href}
              alt={info.name}
              referrerPolicy="no-referrer"
              className="h-12 w-12 flex-shrink-0 rounded-full border border-zinc-700 object-cover"
            />
          )}
          <div>
            <p className="karla-bold text-lg text-zinc-100">{info.name}</p>
            {info.description && (
              <p className="karla-regular mt-0.5 text-sm text-zinc-400">{info.description}</p>
            )}
            <p className="mt-1 font-ibm-plex-mono text-xs text-zinc-500">{mintUrl}</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default MintCard
