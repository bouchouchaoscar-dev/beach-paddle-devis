/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [],
  },
  // Suppress html2canvas/jsPDF warnings in edge runtime
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), "canvas", "jsdom"];
    }
    return config;
  },
};

export default nextConfig;
