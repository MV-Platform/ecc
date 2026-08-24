#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

const rolesDirectory = process.argv[2];

if (!rolesDirectory) {
  process.stderr.write('Usage: normalize-codex-agent-roles.js <roles-directory>\n');
  process.exit(2);
}

const expectedRoles = new Map([
  ['docs-researcher.toml', {
    name: 'docs-researcher',
    description: 'Documentation specialist that verifies APIs, framework behavior, and release notes.',
  }],
  ['explorer.toml', {
    name: 'explorer',
    description: 'Read-only codebase explorer for gathering evidence before changes are proposed.',
  }],
  ['reviewer.toml', {
    name: 'reviewer',
    description: 'PR reviewer focused on correctness, security, and missing tests.',
  }],
]);

function assignmentPattern(fieldName) {
  return new RegExp(`^\\s*${fieldName}\\s*=.*$`, 'm');
}

function nonEmptyStringPattern(fieldName) {
  return new RegExp(`^\\s*${fieldName}\\s*=\\s*(?:"[^"]*[^\\s"]+[^"]*"|'[^']*[^\\s']+[^']*')\\s*(?:#.*)?$`, 'm');
}

function ensureStringAssignment(content, fieldName, value, afterFieldName = null) {
  const validPattern = nonEmptyStringPattern(fieldName);
  const fieldPattern = assignmentPattern(fieldName);
  const assignment = `${fieldName} = ${JSON.stringify(value)}`;

  if (validPattern.test(content)) return content;
  if (fieldPattern.test(content)) return content.replace(fieldPattern, assignment);

  if (afterFieldName) {
    const afterPattern = assignmentPattern(afterFieldName);
    if (afterPattern.test(content)) {
      return content.replace(afterPattern, matched => `${matched}\n${assignment}`);
    }
  }

  return `${assignment}\n${content}`;
}

for (const [fileName, role] of expectedRoles) {
  const filePath = path.join(rolesDirectory, fileName);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    process.stderr.write(`Error: required Codex agent role file not found: ${filePath}\n`);
    process.exit(1);
  }

  const original = fs.readFileSync(filePath, 'utf8');
  let updated = ensureStringAssignment(original, 'name', role.name);
  updated = ensureStringAssignment(updated, 'description', role.description, 'name');

  if (updated !== original) {
    const temporaryPath = `${filePath}.mv-platform-${process.pid}.tmp`;
    const mode = fs.statSync(filePath).mode & 0o777;
    fs.writeFileSync(temporaryPath, updated, { mode });
    fs.renameSync(temporaryPath, filePath);
  }
}

const malformedFiles = fs.readdirSync(rolesDirectory, { withFileTypes: true })
  .filter(entry => entry.isFile() && entry.name.endsWith('.toml'))
  .map(entry => path.join(rolesDirectory, entry.name))
  .map(filePath => {
    const content = fs.readFileSync(filePath, 'utf8');
    const missingFields = ['name', 'description']
      .filter(fieldName => !nonEmptyStringPattern(fieldName).test(content));
    return { filePath, missingFields };
  })
  .filter(result => result.missingFields.length > 0);

if (malformedFiles.length > 0) {
  process.stderr.write(
    `Error: Codex agent role files still have missing required fields:\n${malformedFiles.map(result => `  ${result.filePath}: ${result.missingFields.join(', ')}`).join('\n')}\n`
  );
  process.exit(1);
}
