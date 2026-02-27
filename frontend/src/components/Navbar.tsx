import React from 'react'

const LOGO_URL = process.env.NEXT_PUBLIC_LOGO_URL ?? ''
const PROJECT_NAME = process.env.NEXT_PUBLIC_PROJECT_NAME ?? 'minibits'
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'recovery'

const Navbar = () => {
  return (
    <div className="fixed left-0 right-0 top-0 z-50 bg-white shadow-sm">
      <nav className="mx-auto flex max-w-[1152px] items-center justify-between px-8 py-5 xl:px-0">
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
              className="rounded-md"
            />
          )}
          <span className="text-[24px] font-bold leading-none text-gray-900">
            {PROJECT_NAME}<span className="text-[#599D52]">.</span>{APP_NAME}
          </span>
        </div>

        {/* Right side pill */}
        {/*<div className="hidden items-center gap-2 lg:flex">
          <span className="rounded-full border border-gray-200 px-4 py-1.5 font-ibm-plex-mono text-sm text-gray-500">
            Cashu ecash recovery
          </span>
        </div>*/}
      </nav>
    </div>
  )
}

export default Navbar
