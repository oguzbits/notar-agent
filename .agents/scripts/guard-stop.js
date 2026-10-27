#!/usr/bin/env node
// Stop: Prüfschritte wie beim Claude-Stop-Hook (scripts/agent/guards.mjs), bei Fehlern geht der Agent weiter.
const { execFileSync, spawnSync } = require('child_process');
const { runAdapter } = require('./adapter');

runAdapter((payload, { buildStopSteps, selectChangedSources }) => {
  if (payload.terminationReason && payload.terminationReason !== 'model_stop') {
    return { decision: 'allow' };
  }
  const porcelain = execFileSync('git', ['status', '--porcelain', '-uall'], {
    encoding: 'utf-8',
    cwd: require('path').join(__dirname, '..', '..'),
  });
  for (const [cmd, args] of buildStopSteps(selectChangedSources(porcelain))) {
    const result = spawnSync(cmd, args, {
      encoding: 'utf-8',
      timeout: 90000,
      cwd: require('path').join(__dirname, '..', '..'),
    });
    if (result.status !== 0) {
      const out = `${result.stdout ?? ''}${result.stderr ?? ''}`.slice(-1500);
      return {
        decision: 'continue',
        reason: `Verifikation fehlgeschlagen (${cmd} ${args.slice(0, 2).join(' ')}):\n${out}`,
      };
    }
  }
  return { decision: 'allow' };
});
