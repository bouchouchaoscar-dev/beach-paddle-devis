/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [],
  },
  // @react-pdf/renderer must run as a native Node module (not bundled)
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default nextConfig;
