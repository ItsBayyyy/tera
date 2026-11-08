import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // No AGENTS.md or agent feedback blocks written by `next dev`.
  agentRules: false,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    // A stray package-lock.json higher up the folder tree would otherwise become the root.
    root: path.join(__dirname),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
