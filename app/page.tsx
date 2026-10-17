import { AuditPreview } from '@/components/audit-preview'
import { Contacts } from '@/components/contacts'
import { Hero } from '@/components/hero'
import { HowItWorks } from '@/components/how-it-works'
import { Pricing } from '@/components/pricing'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'

export default function Page() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <HowItWorks />
        <AuditPreview />
        <Pricing />
        <Contacts />
      </main>
      <SiteFooter />
    </>
  )
}
