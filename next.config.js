/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'interstatetire.online',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
