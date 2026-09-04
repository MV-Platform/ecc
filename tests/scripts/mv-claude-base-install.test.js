/**
 * Regression coverage for the MV-Platform selective Claude base installer.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.join(__dirname, '..', '..');
const installScript = path.join(repoRoot, 'mv-configs', 'install-base.sh');
const baseSkills = [
  'coding-standards',
  'documentation-lookup',
  'search-first',
  'security-review',
  'terminal-ops',
  'github-ops',
];

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    return true;
  } catch (error) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${error.message}`);
    return false;
  }
}

function createTempHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mv-claude-base-home-'));
}

function runInstaller(homeDir, args = []) {
  return spawnSync('bash', [installScript, ...args], {
    cwd: repoRoot,
    env: {
      ...process.env,
      HOME: homeDir,
      USERPROFILE: homeDir,
      XDG_CONFIG_HOME: path.join(homeDir, '.config'),
      GIT_CONFIG_GLOBAL: path.join(homeDir, '.gitconfig'),
      CLAUDE_PACKAGE_MANAGER: 'npm',
      CLAUDE_CODE_PACKAGE_MANAGER: 'npm',
    },
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function readInstallState(homeDir) {
  const statePath = path.join(homeDir, '.claude', 'ecc', 'install-state.json');
  return JSON.parse(fs.readFileSync(statePath, 'utf8'));
}

function directorySnapshot(directory) {
  const snapshot = [];

  function visit(currentDirectory) {
    for (const entry of fs.readdirSync(currentDirectory, { withFileTypes: true })) {
      const entryPath = path.join(currentDirectory, entry.name);
      const relativePath = path.relative(directory, entryPath).split(path.sep).join('/');
      if (entry.isDirectory()) {
        snapshot.push(`${relativePath}/`);
        visit(entryPath);
      } else if (entry.isFile()) {
        snapshot.push(`${relativePath}:${fs.readFileSync(entryPath).toString('base64')}`);
      }
    }
  }

  visit(directory);
  return snapshot.sort();
}

function assertBaseFiles(homeDir) {
  const claudeRoot = path.join(homeDir, '.claude');
  for (const skill of baseSkills) {
    assert.ok(
      fs.existsSync(path.join(claudeRoot, 'skills', skill, 'SKILL.md')),
      `missing Base skill: ${skill}`
    );
  }
  assert.ok(fs.existsSync(path.join(claudeRoot, 'rules', 'ecc', 'common')));
  assert.ok(fs.existsSync(path.join(
    claudeRoot,
    'rules',
    'mv',
    'git-commit-rules.md'
  )));
}

let passed = 0;
let failed = 0;

console.log('\n=== Testing MV Claude base install ===\n');

if (test('default install succeeds without enabling automatic hooks', () => {
  const homeDir = createTempHome();
  try {
    const result = runInstaller(homeDir);
    assert.strictEqual(result.status, 0, result.stderr || result.stdout);
    assert.ok(result.stdout.includes('MV-Platform Base direct copy complete'));

    const state = readInstallState(homeDir);
    assert.strictEqual(state.request.hookConsent, 'declined');
    assert.ok(!state.resolution.selectedModules.includes('hooks-runtime'));
    assert.ok(!fs.existsSync(path.join(homeDir, '.claude', 'hooks', 'hooks.json')));
    assertBaseFiles(homeDir);
  } finally {
    fs.rmSync(homeDir, { recursive: true, force: true });
  }
})) passed += 1; else failed += 1;

if (test('default reinstall preserves a previously declined hook decision', () => {
  const homeDir = createTempHome();
  try {
    const firstResult = runInstaller(homeDir);
    assert.strictEqual(firstResult.status, 0, firstResult.stderr || firstResult.stdout);
    const secondResult = runInstaller(homeDir);
    assert.strictEqual(secondResult.status, 0, secondResult.stderr || secondResult.stdout);

    const state = readInstallState(homeDir);
    assert.strictEqual(state.request.hookConsent, 'declined');
    assert.ok(!state.resolution.selectedModules.includes('hooks-runtime'));
    assert.ok(!fs.existsSync(path.join(homeDir, '.claude', 'hooks', 'hooks.json')));
  } finally {
    fs.rmSync(homeDir, { recursive: true, force: true });
  }
})) passed += 1; else failed += 1;

if (test('explicit hook opt-in installs the automatic hook runtime', () => {
  const homeDir = createTempHome();
  try {
    const result = runInstaller(homeDir, ['--enable-hooks']);
    assert.strictEqual(result.status, 0, result.stderr || result.stdout);

    const state = readInstallState(homeDir);
    assert.strictEqual(state.request.hookConsent, 'enabled');
    assert.ok(state.resolution.selectedModules.includes('hooks-runtime'));
    assert.ok(fs.existsSync(path.join(homeDir, '.claude', 'hooks', 'hooks.json')));
    assertBaseFiles(homeDir);
  } finally {
    fs.rmSync(homeDir, { recursive: true, force: true });
  }
})) passed += 1; else failed += 1;

if (test('default reinstall preserves a previously enabled hook decision', () => {
  const homeDir = createTempHome();
  try {
    const enabledResult = runInstaller(homeDir, ['--enable-hooks']);
    assert.strictEqual(enabledResult.status, 0, enabledResult.stderr || enabledResult.stdout);

    const reinstallResult = runInstaller(homeDir);
    assert.strictEqual(
      reinstallResult.status,
      0,
      reinstallResult.stderr || reinstallResult.stdout
    );

    const state = readInstallState(homeDir);
    assert.strictEqual(state.request.hookConsent, 'enabled');
    assert.ok(state.resolution.selectedModules.includes('hooks-runtime'));
    assert.ok(fs.existsSync(path.join(homeDir, '.claude', 'hooks', 'hooks.json')));
  } finally {
    fs.rmSync(homeDir, { recursive: true, force: true });
  }
})) passed += 1; else failed += 1;

if (test('explicit hook disable refuses to orphan a previously managed runtime', () => {
  const homeDir = createTempHome();
  try {
    const enabledResult = runInstaller(homeDir, ['--enable-hooks']);
    assert.strictEqual(enabledResult.status, 0, enabledResult.stderr || enabledResult.stdout);
    const statePath = path.join(homeDir, '.claude', 'ecc', 'install-state.json');
    const hooksPath = path.join(homeDir, '.claude', 'hooks');
    const stateBeforeDisable = fs.readFileSync(statePath);
    const hooksBeforeDisable = directorySnapshot(hooksPath);

    const disableResult = runInstaller(homeDir, ['--no-hooks']);
    assert.strictEqual(disableResult.status, 1);
    assert.ok(disableResult.stderr.includes('cannot safely remove'));
    assert.ok(disableResult.stderr.includes('ECC uninstaller'));

    const state = readInstallState(homeDir);
    assert.strictEqual(state.request.hookConsent, 'enabled');
    assert.ok(state.resolution.selectedModules.includes('hooks-runtime'));
    assert.ok(fs.existsSync(path.join(homeDir, '.claude', 'hooks', 'hooks.json')));
    assert.deepStrictEqual(fs.readFileSync(statePath), stateBeforeDisable);
    assert.deepStrictEqual(directorySnapshot(hooksPath), hooksBeforeDisable);
  } finally {
    fs.rmSync(homeDir, { recursive: true, force: true });
  }
})) passed += 1; else failed += 1;

if (test('base install rejects a hard-linked managed skill without changing its external inode', () => {
  if (process.platform === 'win32') return;

  const homeDir = createTempHome();
  const externalDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mv-claude-hardlink-'));
  const externalFile = path.join(externalDir, 'external.md');
  const targetFile = path.join(
    homeDir,
    '.claude',
    'skills',
    'coding-standards',
    'SKILL.md'
  );
  const externalContent = 'external Claude content must remain unchanged\n';
  try {
    fs.writeFileSync(externalFile, externalContent);
    fs.mkdirSync(path.dirname(targetFile), { recursive: true });
    fs.linkSync(externalFile, targetFile);

    const result = runInstaller(homeDir);
    assert.notStrictEqual(result.status, 0);
    assert.ok(result.stderr.includes('hard link'), result.stderr || result.stdout);
    assert.ok(result.stderr.includes(targetFile), result.stderr || result.stdout);
    assert.strictEqual(fs.readFileSync(externalFile, 'utf8'), externalContent);
    assert.strictEqual(fs.statSync(externalFile).nlink, 2);
    assert.ok(!fs.existsSync(path.join(homeDir, '.claude', 'ecc', 'install-state.json')));
  } finally {
    fs.rmSync(homeDir, { recursive: true, force: true });
    fs.rmSync(externalDir, { recursive: true, force: true });
  }
})) passed += 1; else failed += 1;

if (test('base install rejects a hard-linked upstream core agent destination', () => {
  if (process.platform === 'win32') return;

  const homeDir = createTempHome();
  const externalDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mv-claude-core-hardlink-'));
  const externalFile = path.join(externalDir, 'external.md');
  const targetFile = path.join(homeDir, '.claude', 'agents', 'planner.md');
  const externalContent = 'external Claude agent content must remain unchanged\n';
  try {
    fs.writeFileSync(externalFile, externalContent);
    fs.mkdirSync(path.dirname(targetFile), { recursive: true });
    fs.linkSync(externalFile, targetFile);

    const result = runInstaller(homeDir);
    assert.notStrictEqual(result.status, 0);
    assert.ok(result.stderr.includes('hard link'), result.stderr || result.stdout);
    assert.ok(result.stderr.includes(targetFile), result.stderr || result.stdout);
    assert.strictEqual(fs.readFileSync(externalFile, 'utf8'), externalContent);
    assert.strictEqual(fs.statSync(externalFile).nlink, 2);
    assert.ok(!fs.existsSync(path.join(homeDir, '.claude', 'ecc', 'install-state.json')));
  } finally {
    fs.rmSync(homeDir, { recursive: true, force: true });
    fs.rmSync(externalDir, { recursive: true, force: true });
  }
})) passed += 1; else failed += 1;

console.log(`\nPassed: ${passed}`);
console.log(`Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
