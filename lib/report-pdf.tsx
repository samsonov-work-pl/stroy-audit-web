import { renderToStaticMarkup } from 'react-dom/server'

import { AuditReport } from '@/components/audit-report'

const PLACEHOLDER_PDF = /dummy|sample|placeholder|example\.com/i

export function isRealPdfUrl(url: string | null): url is string {
  return Boolean(url) && !PLACEHOLDER_PDF.test(url as string)
}

const STYLES = `
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  html { background: #eef0f2; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #111; font-size: 11pt; line-height: 1.6; margin: 0; }
  .toolbar { position: sticky; top: 0; z-index: 1; display: flex; gap: 12px; align-items: center; justify-content: space-between; padding: 10px 20px; background: #111; color: #fff; font-size: 13px; }
  .toolbar button { font: inherit; font-weight: 600; cursor: pointer; border: 0; border-radius: 8px; padding: 9px 16px; background: #fff; color: #111; }
  .toolbar button:hover { background: #e6e6e6; }
  .page { max-width: 820px; margin: 24px auto; background: #fff; padding: 40px 48px; border-radius: 6px; box-shadow: 0 2px 16px rgba(0,0,0,.08); }
  .loading { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; min-height: 100vh; padding: 24px; text-align: center; color: #555; font-size: 15px; }
  .loading h1 { margin: 0; font-size: 18px; color: #111; }
  .loading p { margin: 0; }
  .spinner { width: 56px; height: 56px; border-radius: 50%; border: 4px solid #d9dce0; border-top-color: #111; animation: spin .9s linear infinite; }
  .bar { position: relative; width: min(320px, 80vw); height: 4px; border-radius: 4px; background: #d9dce0; overflow: hidden; }
  .bar::after { content: ""; position: absolute; inset: 0; width: 40%; border-radius: 4px; background: #111; animation: slide 1.6s ease-in-out infinite; }
  .steps { position: relative; height: 22px; width: min(360px, 90vw); font-size: 13px; color: #777; }
  .steps span { position: absolute; inset: 0; opacity: 0; animation: step 16s infinite; }
  .steps span:nth-child(2) { animation-delay: 4s; }
  .steps span:nth-child(3) { animation-delay: 8s; }
  .steps span:nth-child(4) { animation-delay: 12s; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes slide { 0% { transform: translateX(-100%); } 100% { transform: translateX(250%); } }
  @keyframes step { 0% { opacity: 0; transform: translateY(6px); } 3%, 22% { opacity: 1; transform: none; } 25%, 100% { opacity: 0; transform: translateY(-6px); } }
  @media (prefers-reduced-motion: reduce) {
    .spinner, .bar::after { animation-duration: 3s; }
    .steps span { animation: none; } .steps span:first-child { opacity: 1; }
  }
  header { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 20px; }
  header strong { font-size: 15pt; }
  header span { font-size: 9pt; color: #555; text-align: right; }
  h1, h2, h3, h4 { page-break-after: avoid; margin: 20px 0 8px; line-height: 1.3; }
  h1 { font-size: 17pt; } h2 { font-size: 14pt; } h3 { font-size: 12pt; }
  p, li { orphans: 3; widows: 3; }
  ul, ol { padding-left: 20px; }
  table { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin: 10px 0; page-break-inside: auto; }
  tr { page-break-inside: avoid; }
  th, td { border: 1px solid #bbb; padding: 5px 7px; text-align: left; vertical-align: top; }
  th { background: #f1f1f1; }
  blockquote, aside { border-left: 3px solid #888; background: #f6f6f6; margin: 10px 0; padding: 8px 12px; }
  hr { border: 0; border-top: 1px solid #ccc; margin: 16px 0; }
  svg { display: none; }
  .chat-invite { margin-top: 28px; padding: 18px 20px; border: 2px solid #111; border-radius: 10px; page-break-inside: avoid; }
  .chat-invite h2 { margin: 0 0 6px; font-size: 13pt; }
  .chat-invite p { margin: 0 0 12px; }
  .chat-invite a { display: inline-block; padding: 9px 16px; border-radius: 8px; background: #111; color: #fff; font-weight: 600; text-decoration: none; }
  .chat-invite small { display: block; margin-top: 10px; font-size: 8pt; color: #666; word-break: break-all; }
  footer { margin-top: 28px; font-size: 8.5pt; color: #666; border-top: 1px solid #ccc; padding-top: 8px; }
  @media print {
    html { background: #fff; }
    .toolbar { display: none; }
    .page { max-width: none; margin: 0; padding: 0; box-shadow: none; border-radius: 0; }
  }
`

// Mobile Chrome ignores the viewport meta in a document.write()-ed about:blank tab and renders it at 980px,
// so the HTML is loaded as a real navigation via a Blob URL instead.
function writeDocument(win: Window, title: string, body: string) {
  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>html{-webkit-text-size-adjust:100%;text-size-adjust:100%}${STYLES}</style></head><body>${body}</body></html>`
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
  win.location.replace(url)
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** Must be called synchronously inside a click handler, otherwise browsers block the popup. */
export function openReportWindow(): Window | null {
  const win = window.open('', '_blank')
  if (!win) return null
  writeDocument(win, 'СтройАудит — формируем отчёт…', `<div class="loading" role="status" aria-live="polite">
      <div class="spinner" aria-hidden="true"></div>
      <h1>Формируем подробный отчёт…</h1>
      <p>Это может занять несколько минут. Не закрывайте вкладку.</p>
      <div class="bar" aria-hidden="true"></div>
      <div class="steps" aria-hidden="true">
        <span>Анализируем данные</span>
        <span>Сверяем решения с нормативной базой</span>
        <span>Оцениваем критичность замечаний</span>
        <span>Оформляем рекомендации по исправлению</span>
      </div>
    </div>`)
  return win
}

function escapeAttr(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

function chatInvite(chatUrl: string) {
  const href = escapeAttr(chatUrl)
  return `<section class="chat-invite">
      <h2>Остались вопросы по проекту?</h2>
      <p>Если хотите дополнить информацию о проекте, обсудить детали или получить рекомендации по контролю важных этапов строительства — перейдите в чат с инженером-ассистентом. Он знает этот отчёт и отвечает только по вашему проекту.</p>
      <a href="${href}" target="_blank" rel="noopener">Перейти в чат по проекту →</a>
      <small>Ссылка персональная — не передавайте её посторонним.<br>${href}</small>
    </section>`
}

export function showReportInWindow(
  win: Window | null,
  { markdown, standards, chatUrl }: { markdown: string; standards: string; chatUrl?: string | null },
) {
  const target = win && !win.closed ? win : window.open('', '_blank')
  if (!target) return false
  const report = renderToStaticMarkup(<AuditReport markdown={markdown} />)
  const date = new Date().toLocaleDateString('ru-RU')
  writeDocument(
    target,
    `СтройАудит — отчёт ${date}`,
    `<div class="toolbar"><span>Подробный инженерный аудит · ${standards}</span><button type="button" onclick="window.print()">Сохранить в PDF</button></div>
    <main class="page">
      <header><strong>СтройАудит.ai — инженерный аудит проекта</strong><span>${standards}<br>${date}</span></header>
      ${report}
      ${chatUrl ? chatInvite(chatUrl) : ''}
      <footer>Отчёт сформирован автоматически и носит рекомендательный характер.</footer>
    </main>`,
  )
  target.focus()
  return true
}
