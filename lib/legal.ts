export const LEGAL_NAME = 'Самсонов Алексей Александрович'
export const LEGAL_EMAIL = 'hello@stroyaudit-ai.com'
export const LEGAL_MAILTO = `mailto:${LEGAL_EMAIL}`
export const LEGAL_UPDATED = '21 октября 2026 г.'

export const legalDocuments = [
  { href: '/offer', label: 'Публичная оферта' },
  { href: '/privacy', label: 'Политика конфиденциальности' },
  { href: '/refund', label: 'Условия возврата средств' },
] as const

/** Official publications of the acts the service relies on. */
export const laws = {
  rfCivil1: 'https://www.consultant.ru/document/cons_doc_LAW_5142/',
  rfCivil1Art437:
    'https://www.consultant.ru/document/cons_doc_LAW_5142/1a77b2ec302d6a384a228dff59e53680ccffaaca/',
  rfCivil2: 'https://www.consultant.ru/document/cons_doc_LAW_9027/',
  rfCivil2Art782:
    'https://www.consultant.ru/document/cons_doc_LAW_9027/e21d6a868cf614117afa2f93877215e487cd4aee/',
  rfConsumer: 'https://www.consultant.ru/document/cons_doc_LAW_305/',
  rfConsumerArt32:
    'https://www.consultant.ru/document/cons_doc_LAW_305/758e2cfdf136a621c8f66dcb3372b772c7b5e6e8/',
  rfPersonalData: 'https://www.consultant.ru/document/cons_doc_LAW_61801/',
  rfInformation: 'https://www.consultant.ru/document/cons_doc_LAW_61798/',
  rfOfficial: 'http://pravo.gov.ru/',
  byCivil: 'https://pravo.by/document/?guid=3871&p0=hk9800218',
  byConsumer: 'https://pravo.by/document/?guid=3871&p0=H10200090',
  byPersonalData: 'https://pravo.by/document/?guid=3871&p0=H12100099',
  byInformation: 'https://etalonline.by/document/?regnum=h10800455',
  kzCivilGeneral: 'https://adilet.zan.kz/rus/docs/K940001000_',
  kzCivilSpecial: 'https://adilet.zan.kz/rus/docs/K990000409_',
  kzConsumer: 'https://adilet.zan.kz/rus/docs/Z100000274_',
  kzPersonalData: 'https://adilet.zan.kz/rus/docs/Z1300000094',
  kzInformation: 'https://adilet.zan.kz/rus/docs/Z1500000418',
  lava: 'https://lava.top',
} as const
