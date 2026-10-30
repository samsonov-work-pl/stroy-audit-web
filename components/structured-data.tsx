import { referenceAmounts, TARIFF_RUB, type RubRates } from '@/lib/fx'
import { getRubRates } from '@/lib/fx-rates'
import { LEGAL_EMAIL } from '@/lib/legal'
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site'

const plans = [
  {
    name: 'Экспресс',
    amountRub: TARIFF_RUB.express,
    details: 'Бесплатная проверка одного проекта. Списание не производится.',
  },
  {
    name: 'Полный аудит',
    amountRub: TARIFF_RUB.full,
    details: 'Цена одного проекта. Списание в российских рублях через Lava.top.',
  },
  {
    name: 'Для застройщика',
    amountRub: TARIFF_RUB.developer,
    details: 'Подписка на месяц. Списание в российских рублях через Lava.top.',
  },
] as const

function offer(name: string, price: number, currency: 'RUB' | 'BYN', details: string) {
  return {
    '@type': 'Offer',
    name,
    price: String(price),
    priceCurrency: currency,
    availability: 'https://schema.org/InStock',
    url: `${SITE_URL}/#pricing`,
    description: details,
  }
}

function referenceDate(value: string) {
  return value.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? value.slice(0, 32)
}

function softwareApplication(rates: RubRates | null) {
  const offers = plans.flatMap((plan) => {
    const rub = offer(plan.name, plan.amountRub, 'RUB', plan.details)
    if (!rates) return [rub]
    const reference = referenceAmounts(plan.amountRub, rates)
    if (!reference) return [rub]
    return [
      rub,
      offer(
        `${plan.name}, справочно в BYN`,
        reference.byn,
        'BYN',
        `Справочная сумма по курсу Банка России на ${referenceDate(rates.updatedAt)}. К оплате принимаются только рубли.`,
      ),
    ]
  })

  return {
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: `${SITE_URL}/`,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'All',
    inLanguage: 'ru',
    offers,
    provider: {
      '@type': 'Person',
      name: 'Самсонов Алексей Александрович',
      email: LEGAL_EMAIL,
    },
  }
}

function faqPage() {
  return {
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Удаляются ли чертежи и персональные данные после аудита?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Чертежи и сметы удаляются автоматически сразу после обработки и не хранятся как архив проекта. Это не режим Zero-Data Retention: сервис обрабатывает минимально нужные данные — адрес электронной почты для отчёта, технические метаданные (IP-адрес и тип браузера) и платёжные идентификаторы. Номер банковской карты остаётся у Lava.top. Личный кабинет и пароль не требуются. Подробности — в политике конфиденциальности.',
        },
      },
      {
        '@type': 'Question',
        name: 'По каким нормативам проверяются проект и смета?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Пользователь выбирает страну норм. Для России это СП и ГОСТ РФ, для Беларуси — СН и СП РБ, для Казахстана — СН РК. Конкретный пункт приводится в замечании только если модель в нём уверена. Документы серии СН, например СН 4.02.01-2019, могут быть указаны, когда к ним относится проверяемый раздел; отдельная гарантия проверки именно этого свода в каждом отчёте не даётся.',
        },
      },
    ],
  }
}

function jsonLd(data: unknown) {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

export async function StructuredData() {
  const rates = await getRubRates()
  const software = { '@context': 'https://schema.org', ...softwareApplication(rates) }
  const faq = { '@context': 'https://schema.org', ...faqPage() }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(software) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(faq) }} />
    </>
  )
}
