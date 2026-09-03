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

console.log(`\nPassed: ${passed}`);
console.log(`Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
