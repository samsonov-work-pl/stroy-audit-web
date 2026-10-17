export const JURISDICTIONS = [
  { value: 'russia', flag: '🇷🇺', name: 'Россия', standards: 'СП и ГОСТ РФ', code: 'RU' },
  { value: 'belarus', flag: '🇧🇾', name: 'Беларусь', standards: 'СН и СП РБ', code: 'BY' },
  { value: 'kazakhstan', flag: '🇰🇿', name: 'Казахстан', standards: 'СН РК', code: 'KZ' },
  { value: 'eurocodes', flag: '🇪🇺', name: 'Другие', standards: 'Eurocodes', code: 'EU' },
] as const

export type Jurisdiction = (typeof JURISDICTIONS)[number]['value']

const PROMPT_BASE_URL = 'https://raw.githubusercontent.com/samsonov-work-pl/stroy-audit-api/main'

export function getJurisdiction(value: Jurisdiction) {
  return JURISDICTIONS.find((j) => j.value === value) ?? JURISDICTIONS[0]
}

export async function fetchPromptTemplate(value: Jurisdiction, signal?: AbortSignal) {
  const res = await fetch(`${PROMPT_BASE_URL}/${value}.md`, { signal, cache: 'no-store' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}
