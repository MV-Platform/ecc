#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

const { assertWithinTrustedRoot } = require('../../scripts/lib/path-safety');

function existingStat(filePath) {
  try {
    return fs.lstatSync(filePath);
  } catch (error) {
    if (error && (error.code === 'ENOENT' || error.code === 'ENOTDIR')) {
      return null;
    }
    throw error;
  }
}

function assertSafeExistingTree(targetPath) {
  const stat = fs.lstatSync(targetPath);
  if (stat.isSymbolicLink()) {
    throw new Error(`install target contains a symbolic link: ${targetPath}`);
  }
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
      assertSafeExistingTree(path.join(targetPath, entry.name));
    }
    return;
  }
  if (!stat.isFile()) {
    throw new Error(`install target contains a non-regular file: ${targetPath}`);
  }
  if (stat.nlink > 1) {
    throw new Error(`install target contains a hard link: ${targetPath}`);
  }
}

function assertSafeInstallPath(rootPath, targetPath) {
  const resolvedRoot = path.resolve(rootPath);
  const resolvedTarget = path.resolve(targetPath);
  const relativePath = path.relative(resolvedRoot, resolvedTarget);

  if (
    relativePath === '..'
    || relativePath.startsWith(`..${path.sep}`)
    || path.isAbsolute(relativePath)
  ) {
    throw new Error(`install target is outside the trusted root: ${targetPath}`);
  }

  const rootStat = existingStat(resolvedRoot);
  if (!rootStat || !rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error(`trusted install root must be a real directory: ${rootPath}`);
  }

  assertWithinTrustedRoot(resolvedTarget, resolvedRoot, 'prepare MV-Platform install');

  const segments = relativePath.split(path.sep).filter(Boolean);
  let currentPath = resolvedRoot;
  for (let index = 0; index < segments.length; index += 1) {
    currentPath = path.join(currentPath, segments[index]);
    const stat = existingStat(currentPath);
    if (!stat) break;
    if (stat.isSymbolicLink()) {
      throw new Error(`install target contains a symbolic link: ${currentPath}`);
    }
    if (index < segments.length - 1 && !stat.isDirectory()) {
      throw new Error(`install target parent is not a directory: ${currentPath}`);
    }
  }

  const targetStat = existingStat(resolvedTarget);
  if (targetStat) {
    assertSafeExistingTree(resolvedTarget);
  }
}

function main(args = process.argv.slice(2)) {
  const [trustedRoot, ...targetPaths] = args;
  if (!trustedRoot || targetPaths.length === 0) {
    process.stderr.write(
      'Usage: assert-safe-install-paths.js <trusted-root> <target-path>...\n'
    );
    return 2;
  }

  try {
    for (const targetPath of targetPaths) {
      assertSafeInstallPath(trustedRoot, targetPath);
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
  assertSafeInstallPath,
  main,
};
