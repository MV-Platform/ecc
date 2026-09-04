#!/usr/bin/env node

'use strict';

const fs = require('fs');

const { getRecordedHookConsent } = require('../../scripts/lib/install/hook-consent');
const { readInstallState } = require('../../scripts/lib/install-state');

const [statePath] = process.argv.slice(2);

if (!statePath) {
  process.stderr.write('Usage: resolve-claude-hook-consent.js <install-state>\n');
  process.exit(2);
}

try {
  let stat;
  try {
    stat = fs.lstatSync(statePath);
  } catch (error) {
    if (!error || (error.code !== 'ENOENT' && error.code !== 'ENOTDIR')) throw error;
    process.stdout.write('declined\n');
    process.exit(0);
  }

  if (!stat.isFile()) {
    throw new Error(`Claude install-state must be a regular file: ${statePath}`);
  }

  const state = readInstallState(statePath);
  const recordedConsent = getRecordedHookConsent(state);
  process.stdout.write(`${recordedConsent === 'enabled' ? 'enabled' : 'declined'}\n`);
} catch (error) {
  process.stderr.write(`Error: ${error.message}\n`);
  process.exit(1);
}
