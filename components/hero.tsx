import { UploadCard } from '@/components/upload-card'

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div
        aria-hidden="true"
        className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_30%,black_30%,transparent_100%)]"
      />
      <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-14 px-5 pb-20 pt-20 md:pb-28 md:pt-28">
        <div className="flex flex-col items-center gap-7 text-center">
          <h1
            className="animate-fade-up max-w-4xl text-balance text-[2.6rem] font-extrabold leading-[1.05] tracking-[-0.035em] sm:text-6xl lg:text-7xl"
            style={{ animationDelay: '0ms' }}
          >
            Экспресс-аудит проекта до начала стройки
          </h1>
          <p
            className="animate-fade-up max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg"
            style={{ animationDelay: '200ms' }}
          >
            Искусственный интеллект проверит чертежи и смету на соответствие нормативам вашей страны,
            найдет скрытые ошибки, сложные нюансы и поможет сберечь финансы и нервы всех участников
            стройки.
          </p>
        </div>
        <div className="animate-fade-up w-full max-w-xl" style={{ animationDelay: '320ms' }}>
          <UploadCard />
        </div>
      </div>
    </section>
  )
}
