/**
 * Regression coverage for the MV-Platform selective Codex base installer.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.join(__dirname, '..', '..');
const installScript = path.join(repoRoot, 'mv-configs', 'install-base-codex.sh');
const codexSupplement = fs.readFileSync(
  path.join(repoRoot, '.codex', 'AGENTS.md'),
  'utf8'
);
const managedStart = '<!-- mv-platform:ecc-global-rules:start -->';
const managedEnd = '<!-- mv-platform:ecc-global-rules:end -->';
const legacySupplement = `# ECC for Codex CLI

This supplements the root \`AGENTS.md\` with Codex-specific guidance.

For repo navigation, surface ownership, and PR diff packet guidance, read
\`docs/CODEX-NAVIGATION-GUIDE.md\` after this supplement.

## Security Without Hooks

Since Codex lacks hooks, security enforcement is instruction-based:
1. Always validate inputs at system boundaries
2. Never hardcode secrets — use environment variables
3. Run \`npm audit\` / \`pip audit\` before committing
4. Review \`git diff\` before every push
5. Use \`sandbox_mode = "workspace-write"\` in config
`;

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
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mv-codex-base-home-'));
}

function runInstaller(homeDir) {
  return spawnSync('bash', [installScript], {
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

function readGlobalAgents(homeDir) {
  return fs.readFileSync(path.join(homeDir, '.codex', 'AGENTS.md'), 'utf8');
}

function countOccurrences(content, value) {
  return content.split(value).length - 1;
}

function assertManagedBlockOnce(content) {
  assert.strictEqual(countOccurrences(content, managedStart), 1);
  assert.strictEqual(countOccurrences(content, managedEnd), 1);
}

let passed = 0;
let failed = 0;

console.log('\n=== Testing MV Codex base install ===\n');

if (test('fresh install excludes ECC repository-only Codex instructions', () => {
  const homeDir = createTempHome();
  try {
    const result = runInstaller(homeDir);
    assert.strictEqual(result.status, 0, result.stderr || result.stdout);

    const installedAgents = readGlobalAgents(homeDir);
    assert.ok(installedAgents.includes(managedStart));
    assert.ok(installedAgents.includes(managedEnd));
    assert.ok(!installedAgents.includes('# ECC for Codex CLI'));
    assert.ok(!installedAgents.includes('docs/CODEX-NAVIGATION-GUIDE.md'));
    assert.strictEqual(
      fs.readdirSync(path.join(homeDir, '.agents', 'skills'), { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .length,
      54
    );
  } finally {
    fs.rmSync(homeDir, { recursive: true, force: true });
  }
})) passed += 1; else failed += 1;

if (test('upgrade removes the exact leaked supplement while preserving user content', () => {
  const homeDir = createTempHome();
  const codexDir = path.join(homeDir, '.codex');
  const userContent = '# Personal Codex Rules\n\nKeep this user-authored text.\n';

  try {
    fs.mkdirSync(codexDir, { recursive: true });
    fs.writeFileSync(
      path.join(codexDir, 'AGENTS.md'),
      `${codexSupplement}\n${userContent}`
    );

    const firstResult = runInstaller(homeDir);
    assert.strictEqual(firstResult.status, 0, firstResult.stderr || firstResult.stdout);
    const secondResult = runInstaller(homeDir);
    assert.strictEqual(secondResult.status, 0, secondResult.stderr || secondResult.stdout);

    const installedAgents = readGlobalAgents(homeDir);
    assert.ok(installedAgents.includes(userContent.trim()));
    assert.ok(!installedAgents.includes('# ECC for Codex CLI'));
    assert.ok(!installedAgents.includes('docs/CODEX-NAVIGATION-GUIDE.md'));
    assertManagedBlockOnce(installedAgents);
  } finally {
    fs.rmSync(homeDir, { recursive: true, force: true });
  }
})) passed += 1; else failed += 1;

if (test('upgrade removes a known legacy supplement while preserving user content', () => {
  const homeDir = createTempHome();
  const codexDir = path.join(homeDir, '.codex');
  const userContent = '# Personal Codex Rules\n\nKeep this legacy user text.\n';

  try {
    fs.mkdirSync(codexDir, { recursive: true });
    fs.writeFileSync(
      path.join(codexDir, 'AGENTS.md'),
      `${legacySupplement}\n${userContent}`
    );

    const result = runInstaller(homeDir);
    assert.strictEqual(result.status, 0, result.stderr || result.stdout);

    const installedAgents = readGlobalAgents(homeDir);
    assert.ok(installedAgents.includes(userContent.trim()));
    assert.ok(!installedAgents.includes('# ECC for Codex CLI'));
    assert.ok(!installedAgents.includes('docs/CODEX-NAVIGATION-GUIDE.md'));
    assertManagedBlockOnce(installedAgents);
  } finally {
    fs.rmSync(homeDir, { recursive: true, force: true });
  }
})) passed += 1; else failed += 1;

if (test('malformed managed markers fail without changing AGENTS.md', () => {
  const homeDir = createTempHome();
  const codexDir = path.join(homeDir, '.codex');
  const agentsPath = path.join(codexDir, 'AGENTS.md');
  const original = `${codexSupplement}\n# User Rules\n\nKeep me.\n\n${managedStart}\nold body\n`;

  try {
    fs.mkdirSync(codexDir, { recursive: true });
    fs.writeFileSync(agentsPath, original);

    const result = runInstaller(homeDir);
    assert.notStrictEqual(result.status, 0);
    assert.ok(result.stderr.includes('Error: malformed MV-Platform block'));
    assert.strictEqual(fs.readFileSync(agentsPath, 'utf8'), original);
  } finally {
    fs.rmSync(homeDir, { recursive: true, force: true });
  }
})) passed += 1; else failed += 1;

console.log(`\nPassed: ${passed}`);
console.log(`Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
