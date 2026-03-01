import Head from 'next/head'
import Navbar from '@/components/Navbar'
import Hero from '@/components/Hero'
import RecoveryFlow from '@/components/RecoveryFlow'
import Footer from '@/components/Footer'

const PROJECT_NAME = process.env.NEXT_PUBLIC_PROJECT_NAME ?? 'Minibits'

export default function Home() {
  return (
    <div className="overflow-x-hidden bg-zinc-950">
      <Head>
        <title>{`Recover Your Ecash Balance. Faster.`}</title>
        <meta
          name="description"
          content={`${PROJECT_NAME} mint ecash recovery tool that is optimized for performance. Your seed phrase never leaves your browser.`}
        />
        <link rel="icon" href="/minibits_icon-32.ico" />
      </Head>

      <Navbar />

      <div id="hero">
        <Hero />
      </div>

      <div id="recovery">
        <RecoveryFlow />
      </div>

      <Footer />
    </div>
  )
}
