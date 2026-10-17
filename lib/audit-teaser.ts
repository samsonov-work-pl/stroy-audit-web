const TEASER_LIMIT = 2
const LOCKED_PREVIEW_LIMIT = 4
const SHOWN_TEXT_LIMIT = 420

function clampText(text: string) {
  if (text.length <= SHOWN_TEXT_LIMIT) return text
  const cut = text.slice(0, SHOWN_TEXT_LIMIT)
  const lastSpace = cut.lastIndexOf(' ')
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : cut.length).replace(/[\s,;:—-]+$/, '')}…`
}
const SUMMARY_HEADING = /резюме|итог|заключени|общ(ая|ие) оценк|summary|вывод/i
const STRENGTHS_HEADING = /плюс|сильн|достоинств|положительн|преимуществ|соответству/i
const STRENGTH_MARKER = /✅|🟢|✔/

export type IssueSeverity = 'critical' | 'major' | 'minor'

export type TeaserIssue = { severity: IssueSeverity; text: string }

export type AuditTeaser = {
  summary: string
  strengths: string[]
  stats: Record<IssueSeverity, number>
  shown: TeaserIssue[]
  locked: TeaserIssue[]
  shownCount: number
  hiddenCount: number
  auditId: string | null
}

type IssueLike =
  | string
  | { title?: unknown; description?: unknown; norm?: unknown; text?: unknown; severity?: unknown; level?: unknown }

function detectSeverity(text: string): IssueSeverity | null {
  if (/🔴|критич/i.test(text)) return 'critical'
  if (/🟡|существен|важн/i.test(text)) return 'major'
  if (/🔵|рекоменд|незначит/i.test(text)) return 'minor'
  return null
}

function normalizeSeverity(value: unknown, fallbackText: string): IssueSeverity {
  if (typeof value === 'string') {
    const v = value.toLowerCase()
    if (/crit|крит|high|red/.test(v)) return 'critical'
    if (/maj|med|warn|важ|сущ|yellow/.test(v)) return 'major'
    if (/min|low|info|рек|blue/.test(v)) return 'minor'
  }
  return detectSeverity(fallbackText) ?? 'critical'
}

function issueFromStructured(issue: IssueLike): TeaserIssue | null {
  if (typeof issue === 'string') {
    const text = cleanIssueText(issue)
    return text ? { severity: detectSeverity(issue) ?? 'critical', text } : null
  }
  const title = typeof issue.title === 'string' ? issue.title : typeof issue.text === 'string' ? issue.text : ''
  const description = typeof issue.description === 'string' ? issue.description : ''
  const norm = typeof issue.norm === 'string' ? ` _(${issue.norm})_` : ''
  const text = [title && `**${title}**`, description].filter(Boolean).join(' — ') + norm
  if (!text.trim()) return null
  return { severity: normalizeSeverity(issue.severity ?? issue.level, text), text }
}

function cleanIssueText(line: string) {
  const text = line.startsWith('|')
    ? line
        .split('|')
        .map((cell) => cell.trim())
        .filter(Boolean)
        .join(' — ')
    : line.replace(/^(?:[-*+]|\d+[.)])\s+/, '').replace(/^>\s*/, '')
  return text.replace(/🔴|🟡|🔵/g, '').replace(/^\s*[—:-]\s*/, '').trim()
}

type Section = { heading: string; body: string }

function splitSections(markdown: string): { intro: string; sections: Section[] } {
  const lines = markdown.split('\n')
  const sections: Section[] = []
  const intro: string[] = []
  let current: Section | null = null
  for (const line of lines) {
    const match = /^#{1,4}\s+(.+)$/.exec(line.trim())
    if (match) {
      current = { heading: match[1], body: '' }
      sections.push(current)
    } else if (current) {
      current.body += `${line}\n`
    } else {
      intro.push(line)
    }
  }
  return { intro: intro.join('\n').trim(), sections }
}

function listItems(body: string) {
  return body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^(?:[-*+]|\d+[.)])\s+/.test(line) || STRENGTH_MARKER.test(line))
    .map((line) =>
      line
        .replace(/^(?:[-*+]|\d+[.)])\s+/, '')
        .replace(/✅|🟢|✔️?/g, '')
        .trim(),
    )
    .filter(Boolean)
}

function headingSeverity(heading: string): IssueSeverity | null {
  if (/🔴|критич/i.test(heading)) return 'critical'
  if (/🟡|спорн|важн|существен/i.test(heading)) return 'major'
  if (/🔵|уточн|рекоменд|недостающ/i.test(heading)) return 'minor'
  return null
}

const HINT_LINE = /^\*?\(.*\)\*?\.?$/
const ITEM_LINE = /^(?:[-*+]|\d+[.)])\s+/

// The backend prompt groups findings under headings like "🔴 2. Критически важное",
// "🟡 3. Спорные решения", "🔵 4. Нужно уточнить"; the items themselves carry no emoji,
// so severity has to be inherited from the section they appear in.
function extractSectionIssues(markdown: string): TeaserIssue[] {
  const issues: TeaserIssue[] = []
  let severity: IssueSeverity | null = null
  let lastWasItem = false
  for (const raw of markdown.split('\n')) {
    const line = raw.trim()
    const heading = /^#{1,4}\s+(.+)$/.exec(line)
    if (heading) {
      severity = headingSeverity(heading[1])
      lastWasItem = false
      continue
    }
    if (!severity) continue
    if (!line || /^-{3,}$/.test(line) || /^\|?\s*:?-{3,}/.test(line) || HINT_LINE.test(line)) {
      if (!line) lastWasItem = false
      continue
    }
    const text = cleanIssueText(line)
    if (!text) continue
    const isIndented = /^\s{2,}/.test(raw) && ITEM_LINE.test(line)
    const isContinuation = lastWasItem && (isIndented || !ITEM_LINE.test(line))
    if (isContinuation && issues.length > 0) {
      issues[issues.length - 1].text += ` ${text}`
      continue
    }
    if (text.replace(/[*_:]/g, '').trim().split(/\s+/).length <= 2) continue
    issues.push({ severity: detectSeverity(line.slice(0, 3)) ?? severity, text })
    lastWasItem = true
  }
  return issues
}

function extractIssues(markdown: string): TeaserIssue[] {
  const sectioned = extractSectionIssues(markdown)
  if (sectioned.length > 0) return sectioned
  const issues: TeaserIssue[] = []
  for (const raw of markdown.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#') || /^\|?\s*:?-{3,}/.test(line)) continue
    // Only list items, table rows, quotes or emoji-led lines are findings; prose that
    // merely mentions "критические" (e.g. the summary paragraph) is not.
    const isStructured = /^(?:[-*+]|\d+[.)]|\||>)\s*/.test(line) || /^(?:\*\*)?\s*(?:🔴|🟡|🔵)/.test(line)
    if (!isStructured || !/🔴|🟡|🔵|критич/i.test(line)) continue
    const severity = detectSeverity(line)
    const text = cleanIssueText(line)
    if (!severity || !text) continue
    // Skip section labels such as "🔴 Критические замечания" that carry no detail.
    if (text.replace(/[*_:]/g, '').trim().split(/\s+/).length <= 2) continue
    issues.push({ severity, text })
  }
  return issues
}

function readField(data: unknown, keys: string[]) {
  if (!data || typeof data !== 'object') return undefined
  for (const key of keys) {
    const value = (data as Record<string, unknown>)[key]
    if (value !== undefined && value !== null) return value
  }
  return undefined
}

const MASK_ALPHABET = 'аеиоунрстлвкмдпяыбзгчйхжшюцщэф'

// Locked previews never carry the real finding: only the first words survive,
// the rest is replaced with same-shaped filler so nothing useful can be copied.
export function maskIssueText(text: string) {
  const plain = text.replace(/[*_`]/g, '')
  const words = plain.split(/\s+/)
  let seed = plain.length
  return words
    .map((word, index) => {
      if (index < 3) return word
      return word.replace(/[A-Za-zА-Яа-яЁё0-9]/g, () => {
        seed = (seed * 9301 + 49297) % 233280
        return MASK_ALPHABET[seed % MASK_ALPHABET.length]
      })
    })
    .join(' ')
}

const PLACEHOLDER_LOCKED: TeaserIssue[] = [
  { severity: 'critical', text: 'Несущие конструкции: расхождение с расчётной нагрузкой на перекрытие' },
  { severity: 'major', text: 'У��лы кровли: примыкание к стенам и вентиляционным выходам' },
  { severity: 'major', text: 'Теплотехника: сопротивление теплопередаче ограждающих конструкций' },
  { severity: 'minor', text: 'Оформление: недостающие спецификации и ведомости материалов' },
]

export function buildAuditTeaser(data: unknown, report: string | null): AuditTeaser {
  const rawId = readField(data, ['audit_id', 'auditId', 'id'])
  const auditId = typeof rawId === 'string' || typeof rawId === 'number' ? String(rawId) : null
  const markdown = report ?? ''
  const { intro, sections } = splitSections(markdown)

  const structuredIssues = readField(data, ['issues', 'errors', 'critical_errors', 'top_errors'])
  const issues = Array.isArray(structuredIssues)
    ? (structuredIssues as IssueLike[]).map(issueFromStructured).filter((i): i is TeaserIssue => i !== null)
    : extractIssues(markdown)

  const structuredSummary = readField(data, ['summary', 'resume'])
  const summarySection = sections.find((s) => SUMMARY_HEADING.test(s.heading))
  const fallbackSummary = (intro || sections[0]?.body || '')
    .split('\n')
    .filter((line) => !/🔴|🟡|🔵/.test(line) && !/^\s*\|/.test(line))
    .join('\n')
  const summary = (
    typeof structuredSummary === 'string' ? structuredSummary : (summarySection?.body ?? fallbackSummary)
  )
    .trim()
    .slice(0, 1400)

  const structuredStrengths = readField(data, ['strengths', 'pros', 'positives', 'advantages'])
  const strengthsSection = sections.find((s) => STRENGTHS_HEADING.test(s.heading))
  const strengths = (
    Array.isArray(structuredStrengths)
      ? structuredStrengths.filter((s): s is string => typeof s === 'string')
      : strengthsSection
        ? listItems(strengthsSection.body)
        : markdown
            .split('\n')
            .filter((line) => STRENGTH_MARKER.test(line))
            .map((line) => listItems(line)[0] ?? '')
            .filter(Boolean)
  ).slice(0, 5)

  const stats: Record<IssueSeverity, number> = { critical: 0, major: 0, minor: 0 }
  for (const issue of issues) stats[issue.severity] += 1

  const totalField = readField(data, ['total_issues', 'issues_count'])
  const total = typeof totalField === 'number' ? Math.max(totalField, issues.length) : issues.length

  const groups = (['critical', 'major', 'minor'] as const).map((severity) => {
  const group = issues.filter((i) => i.severity === severity)
  const limit = group.length <= 2 ? Math.min(1, group.length) : TEASER_LIMIT
  return { visible: group.slice(0, limit), rest: group.slice(limit) }
  })
  const shown = groups
  .flatMap((g) => g.visible)
  .map((issue) => ({ ...issue, text: clampText(issue.text) }))
  const hiddenCount = Math.max(0, total - shown.length)
  const realLocked = groups.flatMap((g) => g.rest)
  const locked = (realLocked.length > 0 ? realLocked : PLACEHOLDER_LOCKED)
    .slice(0, LOCKED_PREVIEW_LIMIT)
    .map((issue) => ({ severity: issue.severity, text: maskIssueText(issue.text) }))

  return { summary, strengths, stats, shown, locked, shownCount: shown.length, hiddenCount, auditId }
}
