/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      // Default is 1 MB. Admin photo uploads can be larger LinkedIn exports.
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
