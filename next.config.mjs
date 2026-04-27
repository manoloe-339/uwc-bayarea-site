/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Don't bundle these — apify-client uses dynamic require() for
  // proxy-agent, which Vercel's @vercel/nft bundler can't follow,
  // stripping proxy-agent and producing "Cannot find module" at
  // runtime. Marking them external uses node_modules at runtime
  // where dynamic requires work normally.
  serverExternalPackages: ["apify-client", "proxy-agent"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
        pathname: "/**",
      },
    ],
  },
  experimental: {
    serverActions: {
      // Default is 1 MB. Admin photo uploads can be larger LinkedIn exports.
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
