#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

const [statePath, ...userManagedPaths] = process.argv.slice(2);

if (!statePath || userManagedPaths.length === 0) {
  process.stderr.write('Usage: unmanage-codex-user-files.js <install-state> <path>...\n');
  process.exit(2);
}

if (!fs.existsSync(statePath)) {
  process.stderr.write(`Error: Codex install-state not found: ${statePath}\n`);
  process.exit(1);
}

const targets = new Set(userManagedPaths.map(filePath => path.resolve(filePath)));
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));

if (!Array.isArray(state.operations)) {
  process.stderr.write(`Error: invalid Codex install-state operations: ${statePath}\n`);
  process.exit(1);
}

state.operations = state.operations.filter(operation => {
  if (!operation || typeof operation.destinationPath !== 'string') return true;
  return !targets.has(path.resolve(operation.destinationPath));
});

const temporaryPath = `${statePath}.mv-platform-${process.pid}.tmp`;
fs.writeFileSync(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
fs.renameSync(temporaryPath, statePath);
