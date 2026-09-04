#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

const { assertSafeInstallPath } = require('./assert-safe-install-paths');

function parsePlanPayload(content) {
  let payload;
  try {
    payload = JSON.parse(content);
  } catch (error) {
    throw new Error(`unable to parse installer dry-run JSON: ${error.message}`);
  }

  if (!payload || payload.dryRun !== true || !payload.plan) {
    throw new Error('installer dry-run JSON does not contain a plan');
  }
  if (!Array.isArray(payload.plan.operations)) {
    throw new Error('installer dry-run plan does not contain operations');
  }
  if (typeof payload.plan.installStatePath !== 'string') {
    throw new Error('installer dry-run plan does not contain an install-state path');
  }
  return payload.plan;
}

function isWithin(candidatePath, rootPath) {
  const relativePath = path.relative(path.resolve(rootPath), path.resolve(candidatePath));
  return relativePath !== ''
    && relativePath !== '..'
    && !relativePath.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relativePath);
}

function relocatedSkillDestinations(plan, relocation) {
  if (!relocation) return [];

  return plan.operations
    .filter(operation => (
      operation
      && typeof operation.sourceRelativePath === 'string'
      && operation.sourceRelativePath.replace(/\\/g, '/').startsWith('skills/')
      && typeof operation.destinationPath === 'string'
      && isWithin(operation.destinationPath, relocation.legacyRoot)
    ))
    .map(operation => path.join(
      relocation.userRoot,
      path.relative(relocation.legacyRoot, operation.destinationPath)
    ));
}

function installPlanDestinations(plan, relocation = null) {
  const operationDestinations = plan.operations.map((operation, index) => {
    if (!operation || typeof operation.destinationPath !== 'string') {
      throw new Error(`installer operation ${index + 1} has no destination path`);
    }
    return operation.destinationPath;
  });
  const derivedDestinations = [];
  if (plan.adapter && ['claude', 'claude-project'].includes(plan.adapter.target)) {
    if (typeof plan.targetRoot !== 'string') {
      throw new Error('Claude installer plan does not contain a target root');
    }
    derivedDestinations.push(path.join(plan.targetRoot, 'settings.json'));
  }

  return [...new Set([
    plan.installStatePath,
    ...operationDestinations,
    ...derivedDestinations,
    ...relocatedSkillDestinations(plan, relocation),
  ])];
}

function assertSafeInstallPlan(trustedRoot, content, relocation = null) {
  const plan = parsePlanPayload(content);
  for (const destination of installPlanDestinations(plan, relocation)) {
    assertSafeInstallPath(trustedRoot, destination);
  }
}

function main(args = process.argv.slice(2)) {
  const [trustedRoot, legacyRoot, userRoot] = args;
  if (!trustedRoot || ![1, 3].includes(args.length)) {
    process.stderr.write(
      'Usage: assert-safe-install-plan.js <trusted-root> [<legacy-skills-root> <user-skills-root>]\n'
    );
    return 2;
  }

  try {
    const relocation = legacyRoot && userRoot ? { legacyRoot, userRoot } : null;
    assertSafeInstallPlan(trustedRoot, fs.readFileSync(0, 'utf8'), relocation);
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
  assertSafeInstallPlan,
  installPlanDestinations,
  parsePlanPayload,
  relocatedSkillDestinations,
};
