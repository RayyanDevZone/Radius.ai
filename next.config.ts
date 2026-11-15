import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Old auth routes → new ones (keeps bookmarks working).
  async redirects() {
    return [
      { source: "/auth/sign-in", destination: "/login", permanent: false },
      { source: "/auth/sign-up", destination: "/signup", permanent: false },
    ];
  },
  partialPrefetching: true,
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
