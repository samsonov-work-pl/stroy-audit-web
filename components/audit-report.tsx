'use client'

import { createContext, useContext, type ReactNode } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { AlertOctagon, AlertTriangle, Info, Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'

type CalloutTone = 'critical' | 'warning' | 'info' | 'tip'

type HastNode = { type: string; value?: string; children?: HastNode[] }

const CALLOUT_STYLES: Record<CalloutTone, { box: string; icon: typeof Info; label: string }> = {
  critical: { box: 'border-red-500 bg-red-50 text-red-950', icon: AlertOctagon, label: 'Критично' },
  warning: { box: 'border-amber-500 bg-amber-50 text-amber-950', icon: AlertTriangle, label: 'Внимание' },
  info: { box: 'border-blue-500 bg-blue-50 text-blue-950', icon: Info, label: 'Замечание' },
  tip: { box: 'border-emerald-500 bg-emerald-50 text-emerald-950', icon: Lightbulb, label: 'Рекомендация' },
}

// GitHub-style alerts (`> [!WARNING]`) are rewritten into emoji-prefixed lines so a single
// detection path handles both syntaxes.
const ALERT_REWRITES: Record<string, string> = {
  CAUTION: '🔴 **Критично**',
  DANGER: '🔴 **Критично**',
  WARNING: '🟡 **Внимание**',
  IMPORTANT: '🟡 **Важно**',
  NOTE: '🔵 **Примечание**',
  INFO: '🔵 **Примечание**',
  TIP: '🟢 **Рекомендация**',
}

// Service lines the model sometimes leaks before the actual report.
const PREAMBLE_PATTERN = /(запрос\s+классифицирован|включаю\s+режим)/i

function stripPreamble(markdown: string) {
  const lines = markdown.split('\n')
  let start = 0
  let removed = false
  while (start < lines.length) {
    const line = lines[start].trim()
    if (PREAMBLE_PATTERN.test(line)) {
      removed = true
    } else if (line !== '' && !(removed && /^([-*_]\s*){3,}$/.test(line))) {
      break
    }
    start++
  }
  return lines.slice(start).join('\n')
}

const ALERT_LINE = /^(\s*(?:>\s*)*)\[!(\w+)\][ \t]*(.*)$/

// Handles `> [!tip]`, `> [!tip] text` and a bare `[!tip]` line (outside a quote), turning
// them into a quoted, emoji-prefixed paragraph that renders as a callout card.
function normalizeAlerts(markdown: string) {
  const output: string[] = []
  let wrappingBareAlert = false

  for (const line of markdown.split('\n')) {
    const match = line.match(ALERT_LINE)
    const label = match ? ALERT_REWRITES[match[2].toUpperCase()] : undefined

    if (match && label) {
      const [, prefix, , rest] = match
      const quotePrefix = prefix.includes('>') ? prefix : '> '
      wrappingBareAlert = !prefix.includes('>')
      output.push(`${quotePrefix}${label}${rest ? ` — ${rest}` : ''}`)
      continue
    }

    if (wrappingBareAlert) {
      if (line.trim() === '') {
        wrappingBareAlert = false
      } else {
        output.push(`> ${line}`)
        continue
      }
    }

    output.push(line)
  }

  return output.join('\n')
}

// The model sometimes inserts illustrative images (incl. Obsidian `![[file|500]]` embeds)
// whose URLs don't resolve, leaving broken alt text in the report.
function stripImages(markdown: string) {
  return markdown
    .replace(/!\[\[[^\]]*\]\]/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/!\[[^\]]*\]\[[^\]]*\]/g, '')
}

export function cleanReport(markdown: string) {
  return normalizeAlerts(stripPreamble(stripImages(markdown)))
}

function nodeText(node?: HastNode): string {
  if (!node) return ''
  if (node.type === 'text') return node.value ?? ''
  return (node.children ?? []).map(nodeText).join('')
}

function detectTone(text: string, allowKeywords: boolean): CalloutTone | null {
  const t = text.trimStart()
  if (t.startsWith('🔴')) return 'critical'
  if (t.startsWith('🟡') || t.startsWith('⚠')) return 'warning'
  if (t.startsWith('🔵')) return 'info'
  if (t.startsWith('🟢') || t.startsWith('💡')) return 'tip'
  if (!allowKeywords) return null
  if (/^(критич|опасно|ошибка)/i.test(t)) return 'critical'
  if (/^(внимание|важно|предупрежд)/i.test(t)) return 'warning'
  if (/^(примечание|замечание|информация)/i.test(t)) return 'info'
  if (/^(рекомендац|совет)/i.test(t)) return 'tip'
  return null
}

const InsideCallout = createContext(false)

function Callout({ tone, children }: { tone: CalloutTone; children: ReactNode }) {
  const { box, icon: Icon, label } = CALLOUT_STYLES[tone]
  return (
    <InsideCallout.Provider value={true}>
      <aside
        role="note"
        aria-label={label}
        className={cn(
          'not-prose my-5 flex gap-3 rounded-r-lg border-l-4 px-4 py-3 text-sm leading-relaxed',
          box,
        )}
      >
        <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1 [&_a]:underline [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5">
          {children}
        </div>
      </aside>
    </InsideCallout.Provider>
  )
}

function Paragraph({ node, children }: { node?: unknown; children?: ReactNode }) {
  const insideCallout = useContext(InsideCallout)
  const tone = insideCallout ? null : detectTone(nodeText(node as HastNode), false)
  if (tone) return <Callout tone={tone}>{children}</Callout>
  return <p>{children}</p>
}

const components: Components = {
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-lg border border-border">
      <table className="my-0 w-full min-w-[32rem] text-sm">{children}</table>
    </div>
  ),
  th: ({ children, style }) => (
    <th style={style} className="whitespace-nowrap bg-slate-50 px-3 py-2 text-left font-semibold">
      {children}
    </th>
  ),
  td: ({ children, style }) => (
    <td style={style} className="px-3 py-2 align-top">
      {children}
    </td>
  ),
  blockquote: ({ node, children }) => {
    const tone = detectTone(nodeText(node as HastNode), true)
    if (!tone) return <blockquote>{children}</blockquote>
    return <Callout tone={tone}>{children}</Callout>
  },
  p: Paragraph,
  hr: () => <hr className="my-8 border-border" />,
  img: () => null,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
}

export function AuditReport({ markdown }: { markdown: string }) {
  return (
    <article
      className={cn(
        'prose prose-slate max-w-none break-words text-sm sm:text-[15px]',
        'prose-headings:font-bold prose-headings:tracking-tight',
        'prose-h1:text-xl prose-h2:mt-8 prose-h2:border-b prose-h2:border-border prose-h2:pb-2 prose-h2:text-lg prose-h3:text-base',
        'prose-p:leading-relaxed prose-li:my-1 prose-li:marker:text-slate-400',
        'prose-code:rounded prose-code:bg-slate-100 prose-code:px-1 prose-code:py-0.5 prose-code:font-normal prose-code:before:content-none prose-code:after:content-none',
        'prose-blockquote:border-l-slate-300 prose-blockquote:font-normal prose-blockquote:not-italic prose-blockquote:text-slate-600',
        '[&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {cleanReport(markdown)}
      </ReactMarkdown>
    </article>
  )
}
