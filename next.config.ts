import withBundleAnalyzer from '@next/bundle-analyzer';
import { withSentryConfig } from '@sentry/nextjs/config';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactCompiler: true,
  agentRules: false,
};

const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

// Kein Source-Map-Upload und keine Build-Telemetrie: nichts verlässt den Build ohne ausdrückliche Konfiguration.
export default withSentryConfig(bundleAnalyzer(nextConfig), {
  silent: true,
  sourcemaps: { disable: true },
});
