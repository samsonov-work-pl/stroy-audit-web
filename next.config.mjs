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
  async redirects() {
    return [
      { source: '/Project%20example', destination: '/', permanent: false },
      { source: '/Project%20example/:path*', destination: '/', permanent: false },
    ]
  },
}

export default nextConfig
