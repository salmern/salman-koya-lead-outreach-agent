import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Claude Agent SDK spawns a bundled native CLI binary. Keep the server
  // compatible with bundlers by marking the SDK as server-only (never imported
  // from client components).
  serverExternalPackages: ["@anthropic-ai/claude-agent-sdk", "apify-client"],
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;