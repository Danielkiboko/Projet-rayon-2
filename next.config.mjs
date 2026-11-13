/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  serverExternalPackages: ['jspdf', 'fflate'],
  compress: true,
  poweredByHeader: false,
  turbopack: {},
  webpack: (config) => {
    return config;
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/__/auth/:path*',
        destination: 'https://projets-rayons2.firebaseapp.com/__/auth/:path*',
      },
    ];
  },
};

export default nextConfig;
