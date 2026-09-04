#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const supplementHeader = [
  '# ECC for Codex CLI',
  '',
  'This supplements the root `AGENTS.md` with Codex-specific guidance.',
].join('\n');
const navigationReference = '`docs/CODEX-NAVIGATION-GUIDE.md` after this supplement.';
const securityHeadings = [
  '## Security Without Hooks',
  '## Security with Narrower Hooks',
];
const supplementEndLine = '5. Use `sandbox_mode = "workspace-write"` in config';
const managedStart = '<!-- mv-platform:ecc-global-rules:start -->';

function withoutLeadingSeparators(content) {
  return content.replace(/^(?:\r?\n)+/, '');
}

function removeExactSupplement(content, currentSupplement) {
  if (!content.startsWith(currentSupplement)) return null;
  return withoutLeadingSeparators(content.slice(currentSupplement.length));
}

function removeLegacySupplement(content) {
  if (!content.startsWith(supplementHeader)) return null;

  const managedStartIndex = content.indexOf(managedStart);
  const supplementSearchEnd = managedStartIndex === -1
    ? content.length
    : managedStartIndex;
  const supplementRegion = content.slice(0, supplementSearchEnd);

  if (!supplementRegion.includes(navigationReference)) return null;

  const securityHeadingIndex = securityHeadings.reduce((latestIndex, heading) => (
    Math.max(latestIndex, supplementRegion.lastIndexOf(heading))
  ), -1);
  if (securityHeadingIndex === -1) return null;

  const endLineIndex = supplementRegion.indexOf(
    supplementEndLine,
    securityHeadingIndex
  );
  if (endLineIndex === -1) return null;

  const boundary = endLineIndex + supplementEndLine.length;
  const nextCharacter = content[boundary];
  if (nextCharacter !== undefined && nextCharacter !== '\n' && nextCharacter !== '\r') {
    return null;
  }

  return withoutLeadingSeparators(content.slice(boundary));
}

function writeAtomically(filePath, content, mode) {
  const directory = path.dirname(filePath);
  const temporaryPath = path.join(
    directory,
    `.${path.basename(filePath)}.mv-platform-${crypto.randomBytes(8).toString('hex')}.tmp`
  );

  try {
    fs.writeFileSync(temporaryPath, content, { flag: 'wx', mode });
    fs.chmodSync(temporaryPath, mode);
    fs.renameSync(temporaryPath, filePath);
  } finally {
    fs.rmSync(temporaryPath, { force: true });
  }
}

function removeRepositorySupplement(filePath, supplementPath) {
  if (!fs.existsSync(filePath)) return false;

  const stat = fs.lstatSync(filePath);
  if (!stat.isFile()) {
    throw new Error(`Codex AGENTS target must be a regular file: ${filePath}`);
  }
  if (!fs.existsSync(supplementPath) || !fs.statSync(supplementPath).isFile()) {
    throw new Error(`Codex repository supplement not found: ${supplementPath}`);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const currentSupplement = fs.readFileSync(supplementPath, 'utf8');
  const exactResult = removeExactSupplement(content, currentSupplement);
  const updatedContent = exactResult === null
    ? removeLegacySupplement(content)
    : exactResult;

  if (updatedContent === null) {
    if (content.startsWith(supplementHeader) && content.includes(navigationReference)) {
      throw new Error(
        `Unrecognized leaked Codex repository supplement in ${filePath}; refusing to alter user content.`
      );
    }
    return false;
  }

  writeAtomically(filePath, updatedContent, stat.mode & 0o777);
  return true;
}

function main(args = process.argv.slice(2)) {
  const [targetPath, currentSupplementPath] = args;

  if (!targetPath || !currentSupplementPath) {
    process.stderr.write(
      'Usage: remove-codex-repo-agents.js <global-agents-path> <repo-supplement-path>\n'
    );
    return 2;
  }

  try {
    const wasRemoved = removeRepositorySupplement(targetPath, currentSupplementPath);
    if (wasRemoved) {
      process.stdout.write(`Removed repository-only Codex instructions from ${targetPath}\n`);
    }
    return 0;
  } catch (error) {
    process.stderr.write(`Error: ${error.message}\n`);
    return 1;
  }
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  main,
  removeExactSupplement,
  removeLegacySupplement,
  removeRepositorySupplement,
};
