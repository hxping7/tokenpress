/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    formats: ['image/webp', 'image/avif'],
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8081',
        pathname: '/api/v1/media/files/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '4001',
        pathname: '/api/v1/media/files/**',
      },
      {
        protocol: 'http',
        hostname: 'backend',
        port: '4001',
        pathname: '/api/v1/media/files/**',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  transpilePackages: ['@token00/shared', 'tailwindcss', '@tailwindcss/typography'],
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api/v1'
    // Only proxy when using relative path
    if (apiUrl.startsWith('/')) {
      // Docker: use BACKEND_URL, Local: use localhost
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:4001'
      return [
        {
          source: '/api/v1/:path*',
          destination: `${backendUrl}/api/v1/:path*`,
        },
      ]
    }
    return []
  },
}

export default nextConfig
