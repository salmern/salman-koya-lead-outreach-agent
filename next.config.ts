import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Claude Agent SDK (pinned to 0.2.112, the last release that ships a
  // pure-JS cli.js instead of a ~230MB native binary) spawns cli.js as a Node
  // subprocess. Keep it external so the bundler leaves it alone.
  serverExternalPackages: ["@anthropic-ai/claude-agent-sdk", "apify-client"],
  // cli.js is spawned by path, never imported, so file tracing can miss it.
  // Force the whole SDK package into every server function bundle on Vercel.
  outputFileTracingIncludes: {
    // Project skills are loaded from .claude/skills via settingSources: ["project"].
    "/**": ["./node_modules/@anthropic-ai/claude-agent-sdk/**/*", "./.claude/skills/**/*"],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
