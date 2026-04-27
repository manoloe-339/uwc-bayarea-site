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
  async redirects() {
    return [
      // Renamed admin sections (2026-04-27): legacy URLs redirect to the new
      // canonical paths so existing bookmarks keep working.
      { source: "/admin/ticket-events", destination: "/admin/events", permanent: true },
      { source: "/admin/ticket-events/:path*", destination: "/admin/events/:path*", permanent: true },
      { source: "/admin/unsubscribes", destination: "/admin/email/unsubscribes", permanent: true },
      { source: "/admin/unsubscribes/:path*", destination: "/admin/email/unsubscribes/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
