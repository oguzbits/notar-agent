/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'domain-must-not-depend-on-ui',
      comment: 'Reine Domänenlogik (src/lib/dossier) darf niemals von UI-Komponenten abhängen',
      severity: 'error',
      from: { path: '^src/lib/dossier' },
      to: { path: '^src/(components|app)' },
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
