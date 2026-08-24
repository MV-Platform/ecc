#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

const [statePath, legacySkillsRoot, userSkillsRoot, ...additionalSkillNames] = process.argv.slice(2);

if (!statePath || !legacySkillsRoot || !userSkillsRoot) {
  process.stderr.write(
    'Usage: relocate-codex-skills.js <install-state> <legacy-skills-root> <user-skills-root> [additional-skill-name]...\n'
  );
  process.exit(2);
}

if (!fs.existsSync(statePath)) {
  process.stderr.write(`Error: Codex install-state not found: ${statePath}\n`);
  process.exit(1);
}

const resolvedLegacyRoot = path.resolve(legacySkillsRoot);
const resolvedUserRoot = path.resolve(userSkillsRoot);

if (resolvedLegacyRoot === resolvedUserRoot || resolvedLegacyRoot === path.parse(resolvedLegacyRoot).root) {
  process.stderr.write('Error: unsafe or identical Codex skill roots.\n');
  process.exit(1);
}

const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
if (!Array.isArray(state.operations)) {
  process.stderr.write(`Error: invalid Codex install-state operations: ${statePath}\n`);
  process.exit(1);
}

function isWithin(candidatePath, rootPath) {
  const relativePath = path.relative(rootPath, path.resolve(candidatePath));
  return relativePath !== '' && !relativePath.startsWith(`..${path.sep}`) && relativePath !== '..';
}

function validatedSkillName(skillName) {
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(skillName)) {
    process.stderr.write(`Error: invalid Codex skill name: ${skillName}\n`);
    process.exit(1);
  }
  return skillName;
}

const managedSkillNames = new Set(additionalSkillNames.map(validatedSkillName));

for (const operation of state.operations) {
  if (!operation || typeof operation.destinationPath !== 'string') continue;
  if (typeof operation.sourceRelativePath !== 'string') continue;
  if (!operation.sourceRelativePath.replace(/\\/g, '/').startsWith('skills/')) continue;
  if (!isWithin(operation.destinationPath, resolvedLegacyRoot)) continue;

  const relativePath = path.relative(resolvedLegacyRoot, path.resolve(operation.destinationPath));
  const skillName = relativePath.split(path.sep)[0];
  managedSkillNames.add(validatedSkillName(skillName));
}

if (managedSkillNames.size === 0) {
  process.stderr.write('Error: no managed Codex skills found to relocate.\n');
  process.exit(1);
}

fs.mkdirSync(resolvedUserRoot, { recursive: true });

for (const skillName of [...managedSkillNames].sort()) {
  const legacyDirectory = path.join(resolvedLegacyRoot, skillName);
  const userDirectory = path.join(resolvedUserRoot, skillName);
  if (!fs.existsSync(legacyDirectory) || !fs.statSync(legacyDirectory).isDirectory()) continue;

  fs.mkdirSync(userDirectory, { recursive: true });
  fs.cpSync(legacyDirectory, userDirectory, { recursive: true, force: true });
}

const managedLegacyDirectories = [...managedSkillNames]
  .map(skillName => path.join(resolvedLegacyRoot, skillName));

state.operations = state.operations.filter(operation => {
  if (!operation || typeof operation.destinationPath !== 'string') return true;
  return !managedLegacyDirectories.some(directory => (
    path.resolve(operation.destinationPath) === directory
    || isWithin(operation.destinationPath, directory)
  ));
});

for (const legacyDirectory of managedLegacyDirectories) {
  if (fs.existsSync(legacyDirectory) && fs.statSync(legacyDirectory).isDirectory()) {
    fs.rmSync(legacyDirectory, { recursive: true, force: false });
  }
}

const temporaryPath = `${statePath}.mv-platform-${process.pid}.tmp`;
fs.writeFileSync(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
fs.renameSync(temporaryPath, statePath);

process.stdout.write(`Relocated ${managedSkillNames.size} Codex skills to ${resolvedUserRoot}\n`);
