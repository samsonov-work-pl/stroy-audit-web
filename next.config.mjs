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
  async redirects() {
    return [
      { source: '/Project example', destination: '/', permanent: false },
      { source: '/Project example/:path*', destination: '/', permanent: false },
    ]
  },
}

export default nextConfig
