/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'interstatetire.online',
      },
    ],
  },
};

module.exports = nextConfig;
