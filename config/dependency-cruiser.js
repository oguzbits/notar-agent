/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'domain-must-not-depend-on-ui',
      comment: 'Reine Domänen- und Wissenslogik darf niemals von UI-Komponenten abhängen',
      severity: 'error',
      from: { path: '^src/lib/(dossier|knowledge)' },
      to: { path: '^src/(components|app)' },
    },
    {
      name: 'hooks-must-not-depend-on-ui',
      comment: 'Hooks verwalten Zustand/Logik und dürfen niemals von UI-Komponenten abhängen',
      severity: 'error',
      from: { path: '^src/hooks' },
      to: { path: '^src/components' },
    },
    {
      name: 'pure-types-must-not-depend-on-implementation',
      comment:
        'Typen (src/types) dürfen keine Implementierungsdetails aus lib, app oder components importieren',
      severity: 'error',
      from: { path: '^src/types' },
      to: { path: '^src/(lib|app|components|hooks)' },
    },
    {
      name: 'no-domain-types-from-components',
      comment:
        'Komponenten dürfen keine Datentypen für Libs, Hooks oder Types exportieren (Single Source of Truth in src/types)',
      severity: 'error',
      from: { path: '^src/(lib|types|hooks|app)' },
      to: { path: '^src/components', dependencyTypes: ['type-only'] },
    },
    {
      name: 'no-in-memory-imports-in-production-core',
      comment:
        'Produktions-Module (Jobs, Dossier, AI) dürfen niemals direkt aus in-memory importieren. Erlaubt nur in server.ts (Factory) und Tests.',
      severity: 'error',
      from: {
        path: '^src/lib/(dossier|jobs/job-worker|ai|knowledge/rules)',
        pathNot: '\\.test\\.(ts|tsx)$',
      },
      to: { path: '^src/lib/in-memory' },
    },

    {
      name: 'no-circular-dependencies',
      comment: 'Zyklische Abhängigkeiten sind im gesamten Projekt verboten',
      severity: 'error',
      from: { path: '^src' },
      to: {
        circular: true,
      },
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: 'tsconfig.json',
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
  },
};
