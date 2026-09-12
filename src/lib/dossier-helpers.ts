/**
 * BACKWARDS COMPATIBILITY FACADE:
 * Re-exports all domain models, normalizers, readiness rules, and UI mappers from the
 * modularized @/lib/dossier package.
 *
 * This guarantees that existing imports in Next.js routes, server persistence, and UI views
 * remain 100% operational without breaking changes.
 */
export * from './dossier';
