import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';
import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // This monorepo already has its own root-level AI-agent conventions
  // (this project *is* Recall); Next.js would otherwise auto-generate
  // AGENTS.md/CLAUDE.md inside apps/web on every dev/build run, which is
  // redundant and confusing here.
  agentRules: false,
  // This app has no server-side secrets today; keep the surface explicit so
  // a future env var is a deliberate, reviewed addition rather than an
  // accidental client-side leak.
  env: {},
};

export default withSentryConfig(withMDX(nextConfig), {
  org: 'sabahattin-kalkan',
  project: 'recall-web',
  // Suppress build-plugin logs locally; keep them in CI for debuggability.
  silent: !process.env.CI,
  // Upload source maps for Next.js/React internals too, not just app code.
  widenClientFileUpload: true,
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
