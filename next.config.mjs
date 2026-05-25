/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [],
  },
  experimental: {
    // @react-pdf/renderer must run as a native Node module (not bundled)
    serverComponentsExternalPackages: ["@react-pdf/renderer"],
  },
};

export default nextConfig;
