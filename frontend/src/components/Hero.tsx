import React, { useEffect, useRef } from 'react'

const PROJECT_NAME = process.env.NEXT_PUBLIC_PROJECT_NAME ?? 'Minibits'

const Hero = () => {
  const textOverlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const textOverlay = textOverlayRef.current
    if (!textOverlay) return

    const cells = textOverlay.children
    const plainText = 'RESTORE CASHU ECASH SEED RECOVER PROOF'
    const encryptedChars = '!@#$%^&*()_+-=[]{}|;:,.<>?'

    function getRandomChar(isEncrypted: boolean): string {
      if (isEncrypted) return encryptedChars[Math.floor(Math.random() * encryptedChars.length)]
      return plainText[Math.floor(Math.random() * plainText.length)]
    }

    function animateCell(cell: Element, delay: number) {
      setTimeout(() => {
        let isEncrypted = true
        ;(cell as HTMLElement).style.opacity = '1'

        const intervalId = setInterval(() => {
          cell.textContent = getRandomChar(isEncrypted)
          if (Math.random() < 0.1) {
            isEncrypted = false
            clearInterval(intervalId)
            cell.textContent = getRandomChar(false)
            setTimeout(() => {
              ;(cell as HTMLElement).style.opacity = '0'
            }, 2000)
          }
        }, 100)
      }, delay)
    }

    Array.from(cells).forEach((cell, index) => animateCell(cell, index * 50))

    const intervalId = setInterval(() => {
      Array.from(cells).forEach((cell, index) => {
        if (parseFloat((cell as HTMLElement).style.opacity) === 0) {
          animateCell(cell, index * 50)
        }
      })
    }, 5000)

    return () => clearInterval(intervalId)
  }, [])

  return (
    <div className="mt-16">
      <div className="relative w-full px-4 pt-10 sm:px-6 lg:px-8">
        <div className="animated-grid-bg relative mx-auto max-w-7xl overflow-hidden rounded-lg">
          <div className="text-overlay" ref={textOverlayRef}>
            {Array(400)
              .fill(null)
              .map((_, i) => (
                <div key={i} className="text-cell" />
              ))}
          </div>
          <div className="gradient-overlay" />

          {/* Bottom fade */}
          <div
            className="pointer-events-none absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-zinc-950 to-transparent"
          />

          <div className="relative z-10 flex flex-col items-center px-8 pb-16 pt-10 sm:px-12 lg:flex-row lg:px-16">
            <div className="flex flex-col lg:max-w-[70%]">
              <h1 className="mb-4 text-5xl font-bold text-zinc-100 sm:text-6xl">
                <div className="md:flex md:flex-col">
                  <span className="block md:inline">
                    Recover your balance<span style={{ color: '#3680FA' }}>.</span>
                  </span>{' '}
                  <span className="block md:inline">
                    Faster<span style={{ color: '#599D52' }}>.</span>
                  </span>
                </div>
              </h1>
              <p className="mb-8 max-w-2xl font-ibm-plex-mono text-xl font-normal text-zinc-300">
              Ecash recovery tool for {PROJECT_NAME} mint, that is optimized for performance. Your seed phrase never leaves your browser.
              </p>
              {/*<div className="flex flex-wrap gap-4">
                <a
                  href="#recovery"
                  onClick={(e) => {
                    e.preventDefault()
                    document.getElementById('recovery')?.scrollIntoView({ behavior: 'smooth' })
                  }}ß
                  className="bg-black px-6 py-3 font-semibold text-white transition duration-300 ease-in-out hover:bg-gray-800"
                >
                  START RECOVERY
                </a>
                <a
                  href="https://github.com/minibits-cash"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-gray-100 px-6 py-3 font-semibold text-black transition duration-300 ease-in-out hover:bg-gray-200"
                >
                  GITHUB
                </a>
              </div>*/}
            </div>

            {/* Right side graphic */}
            {/*<div className="mt-12 hidden lg:flex lg:flex-shrink-0 lg:items-center lg:pl-12">
              <div className="flex h-[160px] w-[160px] items-center justify-center rounded-full border-2 border-[#f18805] bg-white/80">
                <span className="font-ibm-plex-mono text-4xl font-bold text-[#f18805]">₿</span>
              </div>
            </div>*/}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Hero
