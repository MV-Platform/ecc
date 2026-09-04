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

function contentBeforeManagedBlock(content) {
  const markerIndex = content.indexOf(managedStart);
  assert.notStrictEqual(markerIndex, -1);
  return content.slice(0, markerIndex);
}

let passed = 0;
let failed = 0;

console.log('\n=== Testing MV Codex base install ===\n');

if (test('helper modules are safe to import without running their CLIs', () => {
  const script = `
    require(${JSON.stringify(path.join(repoRoot, 'mv-configs', 'lib', 'copy-file-atomically.js'))});
    require(${JSON.stringify(path.join(repoRoot, 'mv-configs', 'lib', 'remove-codex-repo-agents.js'))});
  `;
  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  assert.strictEqual(result.status, 0, result.stderr || result.stdout);
})) passed += 1; else failed += 1;

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
  const agentsPath = path.join(codexDir, 'AGENTS.md');
  const configPath = path.join(codexDir, 'config.toml');
  const userContent = '# Personal Codex Rules\n\nKeep this user-authored text.\n';
  const userConfig = 'model = "gpt-5.5"\ncustom_setting = true\n';

  try {
    fs.mkdirSync(codexDir, { recursive: true });
    fs.writeFileSync(
      agentsPath,
      `${codexSupplement}\n${userContent}`
    );
    fs.writeFileSync(configPath, userConfig);
    fs.chmodSync(agentsPath, 0o640);
    fs.chmodSync(configPath, 0o640);

    const firstResult = runInstaller(homeDir);
    assert.strictEqual(firstResult.status, 0, firstResult.stderr || firstResult.stdout);
    const firstInstalledAgents = readGlobalAgents(homeDir);
    const secondResult = runInstaller(homeDir);
    assert.strictEqual(secondResult.status, 0, secondResult.stderr || secondResult.stdout);

    const installedAgents = readGlobalAgents(homeDir);
    assert.ok(installedAgents.includes(userContent.trim()));
    assert.ok(!installedAgents.includes('# ECC for Codex CLI'));
    assert.ok(!installedAgents.includes('docs/CODEX-NAVIGATION-GUIDE.md'));
    assertManagedBlockOnce(installedAgents);
    assert.strictEqual(contentBeforeManagedBlock(installedAgents), `${userContent}\n`);
    assert.strictEqual(installedAgents, firstInstalledAgents);
    assert.strictEqual(fs.readFileSync(configPath, 'utf8'), userConfig);
    if (process.platform !== 'win32') {
      assert.strictEqual(fs.statSync(agentsPath).mode & 0o777, 0o640);
      assert.strictEqual(fs.statSync(configPath).mode & 0o777, 0o640);
    }
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
      `${legacySupplement}\n${userContent}${managedStart}\nold managed body\n${managedEnd}\n`
    );

    const firstResult = runInstaller(homeDir);
    assert.strictEqual(firstResult.status, 0, firstResult.stderr || firstResult.stdout);
    const firstInstalledAgents = readGlobalAgents(homeDir);
    const secondResult = runInstaller(homeDir);
    assert.strictEqual(secondResult.status, 0, secondResult.stderr || secondResult.stdout);

    const installedAgents = readGlobalAgents(homeDir);
    assert.ok(installedAgents.includes(userContent.trim()));
    assert.ok(!installedAgents.includes('# ECC for Codex CLI'));
    assert.ok(!installedAgents.includes('docs/CODEX-NAVIGATION-GUIDE.md'));
    assertManagedBlockOnce(installedAgents);
    assert.strictEqual(contentBeforeManagedBlock(installedAgents), userContent);
    assert.strictEqual(installedAgents, firstInstalledAgents);
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
    assert.ok(!fs.existsSync(path.join(codexDir, 'ecc-install-state.json')));
  } finally {
    fs.rmSync(homeDir, { recursive: true, force: true });
  }
})) passed += 1; else failed += 1;

for (const fileName of ['AGENTS.md', 'config.toml']) {
  if (test(`rejects a symlinked global ${fileName} without changing its referent`, () => {
    if (process.platform === 'win32') return;

    const homeDir = createTempHome();
    const externalDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mv-codex-outside-'));
    const codexDir = path.join(homeDir, '.codex');
    const externalFile = path.join(externalDir, fileName);
    const original = `user-owned ${fileName}\n`;
    try {
      fs.mkdirSync(codexDir, { recursive: true });
      fs.writeFileSync(externalFile, original);
      fs.symlinkSync(externalFile, path.join(codexDir, fileName), 'file');

      const result = runInstaller(homeDir);
      assert.notStrictEqual(result.status, 0);
      assert.strictEqual(fs.readFileSync(externalFile, 'utf8'), original);
      assert.ok(!fs.existsSync(path.join(codexDir, 'ecc-install-state.json')));
    } finally {
      fs.rmSync(homeDir, { recursive: true, force: true });
      fs.rmSync(externalDir, { recursive: true, force: true });
    }
  })) passed += 1; else failed += 1;
}

if (test('base install rejects a hard-linked managed skill without changing its external inode', () => {
  if (process.platform === 'win32') return;

  const homeDir = createTempHome();
  const externalDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mv-codex-hardlink-'));
  const externalFile = path.join(externalDir, 'external.md');
  const targetFile = path.join(
    homeDir,
    '.agents',
    'skills',
    'coding-standards',
    'SKILL.md'
  );
  const externalContent = 'external Codex content must remain unchanged\n';
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
    assert.ok(!fs.existsSync(path.join(homeDir, '.codex', 'ecc-install-state.json')));
  } finally {
    fs.rmSync(homeDir, { recursive: true, force: true });
    fs.rmSync(externalDir, { recursive: true, force: true });
  }
})) passed += 1; else failed += 1;

if (test('base install rejects a hard-linked upstream core skill destination', () => {
  if (process.platform === 'win32') return;

  const homeDir = createTempHome();
  const externalDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mv-codex-core-hardlink-'));
  const externalFile = path.join(externalDir, 'external.md');
  const targetFile = path.join(
    homeDir,
    '.codex',
    'skills',
    'tdd-workflow',
    'SKILL.md'
  );
  const externalContent = 'external Codex core content must remain unchanged\n';
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
    assert.ok(!fs.existsSync(path.join(homeDir, '.codex', 'ecc-install-state.json')));
  } finally {
    fs.rmSync(homeDir, { recursive: true, force: true });
    fs.rmSync(externalDir, { recursive: true, force: true });
  }
})) passed += 1; else failed += 1;

if (test('base install rejects a hard-linked relocated core skill destination', () => {
  if (process.platform === 'win32') return;

  const homeDir = createTempHome();
  const externalDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mv-codex-visible-hardlink-'));
  const externalFile = path.join(externalDir, 'external.md');
  const targetFile = path.join(
    homeDir,
    '.agents',
    'skills',
    'tdd-workflow',
    'SKILL.md'
  );
  const externalContent = 'external visible Codex content must remain unchanged\n';
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
    assert.ok(!fs.existsSync(path.join(homeDir, '.codex', 'ecc-install-state.json')));
  } finally {
    fs.rmSync(homeDir, { recursive: true, force: true });
    fs.rmSync(externalDir, { recursive: true, force: true });
  }
})) passed += 1; else failed += 1;

console.log(`\nPassed: ${passed}`);
console.log(`Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
