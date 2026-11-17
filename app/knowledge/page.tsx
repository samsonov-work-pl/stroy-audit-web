import type { Metadata } from 'next'
import Link from 'next/link'
import { ArticlePage } from '@/components/article-page'
import { articleLinks } from '@/lib/articles'

export const metadata: Metadata = {
  title: 'База знаний — СтройАудит.ai',
  description:
    'Материалы о проверке проектов частных домов и смет: зачем проверять проект до начала стройки, где в сметах теряются деньги, типовые ошибки в проектах и состав проекта ИЖС.',
  alternates: { canonical: '/knowledge' },
}

export default function Page() {
  return (
    <ArticlePage title="База знаний" current="/knowledge" showOthers={false}>
      <p>
        Короткие материалы о проверке проектной документации частного дома: когда стоит
        проверять проект до начала стройки, где в сметах незаметно теряются деньги и какие
        ошибки повторяются от объекта к объекту.
      </p>
      <ul>
        {articleLinks.map((link) => (
          <li key={link.href}>
            <Link href={link.href}>{link.label}</Link>
          </li>
        ))}
      </ul>
      <p>
        <strong>Быстрый способ проверить свой проект:</strong>{' '}
        <Link href="/#upload">загрузите файлы на главной странице</Link> — экспресс-аудит
        бесплатный, страна норм (Россия, Беларусь или Казахстан) выбирается при загрузке.
      </p>
    </ArticlePage>
  )
}
