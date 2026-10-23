import { AuditPreview } from '@/components/audit-preview'
import { Contacts } from '@/components/contacts'
import { FxRatesProvider } from '@/components/fx-rates'
import { Hero } from '@/components/hero'
import { HowItWorks } from '@/components/how-it-works'
import { Pricing } from '@/components/pricing'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { getRubRates } from '@/lib/fx-rates'

export default async function Page() {
  const rates = await getRubRates()

  return (
    <FxRatesProvider rates={rates}>
      <SiteHeader />
      <main>
        <Hero />
        <HowItWorks />
        <AuditPreview />
        <Pricing />
        <Contacts />
      </main>
      <SiteFooter />
    </FxRatesProvider>
  )
}
