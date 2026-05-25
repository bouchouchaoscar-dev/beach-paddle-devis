/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [],
  },
  experimental: {
    // Ces packages doivent tourner en Node natif, pas bundlés par webpack
    serverComponentsExternalPackages: ["@react-pdf/renderer", "xlsx"],
  },
};

export default nextConfig;
