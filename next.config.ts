import withBundleAnalyzer from '@next/bundle-analyzer';
import { withSentryConfig } from '@sentry/nextjs/config';
import type { NextConfig } from 'next';
import { SECURITY_HEADERS } from './src/lib/security/security-headers';

const nextConfig: NextConfig = {
  reactCompiler: true,
  agentRules: false,
  headers: async () => [{ source: '/:path*', headers: [...SECURITY_HEADERS] }],
};

const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

// Kein Source-Map-Upload und keine Build-Telemetrie: nichts verlässt den Build ohne ausdrückliche Konfiguration.
export default withSentryConfig(bundleAnalyzer(nextConfig), {
  silent: true,
  telemetry: false,
  sourcemaps: { disable: true },
});
