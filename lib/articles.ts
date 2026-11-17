export type ArticleLink = {
  href: string
  label: string
}

export const articleLinks: ArticleLink[] = [
  { href: '/about', label: 'О сервисе СтройАудит.ai' },
  {
    href: '/proverka-proekta-doma',
    label: 'Зачем проверять проект до начала стройки',
  },
  { href: '/audit-smet', label: 'Аудит сметы на строительство' },
  { href: '/oshibki-v-proekte-doma', label: 'Типовые ошибки в проекте' },
  { href: '/sostav-proekta-izhs', label: 'Из чего состоит проект частного дома' },
]
