import React, { useState, useEffect } from 'react'

const LOGO_URL = process.env.NEXT_PUBLIC_LOGO_URL ?? ''
const PROJECT_NAME = process.env.NEXT_PUBLIC_PROJECT_NAME ?? 'minibits'
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'recovery'

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`fixed left-0 right-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'border-b border-zinc-800 bg-zinc-900/95 backdrop-blur-md shadow-lg'
          : 'border-b border-zinc-800/60 bg-zinc-900'
      }`}
    >
      <nav className="mx-auto flex max-w-[1152px] items-center justify-between px-8 py-4 xl:px-0">
        {/* Logo + wordmark */}
        <div className="flex items-center gap-3">
          {LOGO_URL && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={LOGO_URL}
              alt="Minibits logo"
              referrerPolicy="no-referrer"
              width={36}
              height={36}
              className="rounded-lg"
            />
          )}
          <span className="leading-none text-zinc-100" style={{ fontFamily: '"Hammersmith One", sans-serif', fontSize: '26px' }}>
            {PROJECT_NAME}<span className="text-[#599D52]">.</span>{APP_NAME}
          </span>
        </div>
      </nav>
    </header>
  )
}

export default Navbar
