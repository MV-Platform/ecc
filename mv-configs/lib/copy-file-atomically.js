#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function readRegularFileNoFollow(filePath) {
  const descriptor = fs.openSync(
    filePath,
    fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0)
  );
  try {
    const stat = fs.fstatSync(descriptor);
    if (!stat.isFile()) {
      throw new Error(`source is not a regular file: ${filePath}`);
    }
    return {
      content: fs.readFileSync(descriptor),
      mode: stat.mode & 0o777,
    };
  } finally {
    fs.closeSync(descriptor);
  }
}

function copyFileAtomically(source, target) {
  const targetDirectory = path.dirname(target);
  const targetStat = (() => {
    try {
      return fs.lstatSync(target);
    } catch (error) {
      if (error && (error.code === 'ENOENT' || error.code === 'ENOTDIR')) return null;
      throw error;
    }
  })();

  if (targetStat && (!targetStat.isFile() || targetStat.isSymbolicLink())) {
    throw new Error(`target is not a regular file: ${target}`);
  }

  const sourceFile = readRegularFileNoFollow(source);
  fs.mkdirSync(targetDirectory, { recursive: true });
  const temporaryPath = path.join(
    targetDirectory,
    `.${path.basename(target)}.mv-platform-${crypto.randomBytes(8).toString('hex')}.tmp`
  );

  try {
    fs.writeFileSync(temporaryPath, sourceFile.content, {
      flag: 'wx',
      mode: sourceFile.mode,
    });
    fs.chmodSync(temporaryPath, sourceFile.mode);
    fs.renameSync(temporaryPath, target);
  } finally {
    fs.rmSync(temporaryPath, { force: true });
  }
}

function main(args = process.argv.slice(2)) {
  const [sourcePath, targetPath] = args;

  if (!sourcePath || !targetPath) {
    process.stderr.write('Usage: copy-file-atomically.js <source> <target>\n');
    return 2;
  }

  try {
    copyFileAtomically(sourcePath, targetPath);
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
  copyFileAtomically,
  main,
};
