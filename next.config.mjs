/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    agentUpgrade: 'security',
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Рабочие файлы примера проекта не отдаются с сайта: редирект срабатывает
  // до проверки файловой системы (включая /public), доступ закрыт.
  // Матчинг идёт по закодированному пути, поэтому источник с %20.
  // Для ссылок из примеров отчётов те же файлы открыты по чистым адресам
  // /reports/project-example-*.pdf: rewrites beforeFiles срабатывают после
  // редиректов, но до проверки файловой системы, поэтому файл отдаётся,
  // а прямой доступ к папке остаётся закрытым.
  async redirects() {
    return [
      { source: '/Project%20example', destination: '/', permanent: false },
      { source: '/Project%20example/:path*', destination: '/', permanent: false },
    ]
  },
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/reports/project-example-AR.pdf', destination: '/Project%20example/Project%20example-AR.pdf' },
        { source: '/reports/project-example-IGI.pdf', destination: '/Project%20example/Example%20of%20engineering-geological%20surveys.pdf' },
        { source: '/reports/project-example-VK.pdf', destination: '/Project%20example/Example%20of%20a%20VK%20project.pdf' },
        { source: '/reports/project-example-EOM.pdf', destination: '/Project%20example/Example%20of%20an%20EOM%20%28Electrical%20Power%20and%20Lighting%29%20project.pdf' },
        { source: '/reports/project-example-ES.pdf', destination: '/Project%20example/Example%20of%20an%20ES%20project.pdf' },
        { source: '/reports/project-example-KJ.pdf', destination: '/Project%20example/Example%20of%20a%20structural%20concrete%20project.pdf' },
      ],
    }
  },
}

export default nextConfig
