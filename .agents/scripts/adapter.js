// Protokoll-Adapter für das zweite Agentenwerkzeug: JSON auf stdin, { decision, reason } auf stdout.
// Die Entscheidungen selbst kommen aus scripts/agent/guards.mjs (eine Wahrheitsquelle).
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const guardsUrl = pathToFileURL(path.join(__dirname, '../../scripts/agent/guards.mjs')).href;

/** guards.mjs kennt "ask"; das Werkzeug nennt es "force_ask". */
const toolDecision = (decision) => (decision === 'ask' ? 'force_ask' : decision);

function respond(decision, reason = '') {
  process.stdout.write(`${JSON.stringify({ decision: toolDecision(decision), reason })}\n`);
  process.exit(0);
}

function readPayload() {
  const raw = fs.readFileSync(0, 'utf-8');
  return raw.trim() ? JSON.parse(raw) : {};
}

/** Führt `handler(payload, guards)` aus; bei jedem Fehler wird das Werkzeug nicht blockiert. */
async function runAdapter(handler) {
  try {
    const guards = await import(guardsUrl);
    const result = await handler(readPayload(), guards);
    respond(result.decision, result.reason);
  } catch (err) {
    respond('allow', `Hook-Fehler: ${err.message}`);
  }
}

module.exports = { runAdapter };
