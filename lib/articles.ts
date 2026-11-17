export type ArticleLink = {
  href: string
  label: string
}

export const articleLinks: ArticleLink[] = [
  { href: '/about', label: 'О сервисе СтройАудит.ai' },
  {
    href: '/proverka-proekta-doma',
    label: 'Проверка проекта дома до начала строительства',
  },
  { href: '/audit-smet', label: 'Аудит сметы на строительство дома' },
  {
    href: '/oshibki-v-proekte-doma',
    label: 'Типовые ошибки в проекте частного дома',
  },
  { href: '/sostav-proekta-izhs', label: 'Состав проекта дома ИЖС' },
]
