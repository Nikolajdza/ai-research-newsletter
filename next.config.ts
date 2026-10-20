import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Custom profiles for InsightLoop — see src/server/cache.ts
  cacheLife: {
    // News feeds: refresh in background every 5 min, drop after 1 h idle
    feed: { stale: 60, revalidate: 300, expire: 3600 },
    // Analyzed article body rarely changes
    article: { stale: 120, revalidate: 1800, expire: 21600 },
    // Saved / digests — shorter so toggles feel snappy even without a bust
    personal: { stale: 30, revalidate: 120, expire: 1800 },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
