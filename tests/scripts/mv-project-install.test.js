/**
 * Actual-install coverage for every MV-Platform stack wrapper on both harnesses.
 */

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.join(__dirname, '..', '..');
const mvRoot = path.join(repoRoot, 'mv-configs');
const managedStart = '<!-- mv-platform:ecc-project-rules:start -->';
const managedEnd = '<!-- mv-platform:ecc-project-rules:end -->';
const userAgents = '# Project-specific rules\n\nPreserve this text.\n';

const stacks = {
  'react-vite': {
    rules: ['common', 'typescript', 'web', 'react'],
    skills: [
      'frontend-patterns',
      'react-patterns',
      'react-performance',
      'react-testing',
      'vite-patterns',
      'accessibility',
    ],
  },
  android: {
    rules: ['common', 'kotlin'],
    skills: [
      'android-clean-architecture',
      'kotlin-patterns',
      'kotlin-testing',
      'kotlin-coroutines-flows',
      'compose-multiplatform-patterns',
      'accessibility',
    ],
  },
  ios: {
    rules: ['common', 'swift'],
    skills: [
      'swiftui-patterns',
      'swift-concurrency-6-2',
      'swift-actor-persistence',
      'swift-protocol-di-testing',
      'accessibility',
    ],
  },
  'react-native': {
    rules: ['common', 'typescript', 'react-native'],
    skills: ['react-native-patterns'],
  },
  'spring-kotlin': {
    rules: ['common', 'kotlin'],
    skills: [
      'api-design',
      'springboot-patterns',
      'springboot-tdd',
      'springboot-verification',
      'springboot-security',
      'kotlin-patterns',
      'kotlin-testing',
      'kotlin-coroutines-flows',
      'jpa-patterns',
      'postgres-patterns',
      'database-migrations',
    ],
  },
  fastapi: {
    rules: ['common', 'python'],
    skills: [
      'python-patterns',
      'python-testing',
      'fastapi-patterns',
      'api-design',
      'postgres-patterns',
      'database-migrations',
    ],
  },
  django: {
    rules: ['common', 'python'],
    skills: [
      'python-patterns',
      'python-testing',
      'django-patterns',
      'django-tdd',
      'django-verification',
      'django-security',
      'api-design',
      'postgres-patterns',
      'database-migrations',
    ],
  },
  infra: {
    rules: ['common'],
    skills: ['deployment-patterns', 'docker-patterns', 'kubernetes-patterns'],
  },
};

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

function countOccurrences(content, value) {
  return content.split(value).length - 1;
}

function directoryDigest(directory) {
  const files = [];

  function visit(currentDirectory) {
    for (const entry of fs.readdirSync(currentDirectory, { withFileTypes: true })) {
      const entryPath = path.join(currentDirectory, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
      } else if (entry.isFile()) {
        const relativePath = path.relative(directory, entryPath).split(path.sep).join('/');
        const contentHash = crypto.createHash('sha256')
          .update(fs.readFileSync(entryPath))
          .digest('hex');
        files.push(`${relativePath}:${contentHash}`);
      }
    }
  }

  visit(directory);
  return files.sort();
}

function assertCopiedDirectory(source, target) {
  assert.deepStrictEqual(
    directoryDigest(target),
    directoryDigest(source),
    `copied content differs: ${target}`
  );
}

function installedSnapshot(projectDir, harness) {
  const harnessRoot = harness === 'codex' ? '.agents' : '.claude';
  return {
    harnessFiles: directoryDigest(path.join(projectDir, harnessRoot)),
    agentsContent: fs.readFileSync(path.join(projectDir, 'AGENTS.md'), 'utf8'),
  };
}

function runWrapper(projectDir, stack, harness) {
  const suffix = harness === 'codex' ? '-codex' : '';
  const script = path.join(mvRoot, `install-${stack}${suffix}.sh`);
  return spawnSync('bash', [script], {
    cwd: projectDir,
    env: {
      ...process.env,
      HOME: path.join(projectDir, '.test-home'),
      USERPROFILE: path.join(projectDir, '.test-home'),
    },
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function verifyStack(projectDir, stack, harness, expected) {
  const harnessRoot = harness === 'codex' ? '.agents' : '.claude';
  const rulesRoot = path.join(projectDir, harnessRoot, 'rules', 'ecc');
  const skillsRoot = path.join(projectDir, harnessRoot, 'skills');

  assert.deepStrictEqual(
    fs.readdirSync(rulesRoot, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort(),
    [...expected.rules].sort()
  );
  assert.deepStrictEqual(
    fs.readdirSync(skillsRoot, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort(),
    [...expected.skills].sort()
  );

  for (const rule of expected.rules) {
    assertCopiedDirectory(
      path.join(repoRoot, 'rules', rule),
      path.join(rulesRoot, rule)
    );
  }
  for (const skill of expected.skills) {
    assertCopiedDirectory(
      path.join(repoRoot, 'skills', skill),
      path.join(skillsRoot, skill)
    );
  }

  const agentsContent = fs.readFileSync(path.join(projectDir, 'AGENTS.md'), 'utf8');
  assert.ok(agentsContent.includes(userAgents.trim()));
  if (harness === 'codex') {
    assert.strictEqual(countOccurrences(agentsContent, managedStart), 1);
    assert.strictEqual(countOccurrences(agentsContent, managedEnd), 1);
  } else {
    assert.strictEqual(countOccurrences(agentsContent, managedStart), 0);
    assert.strictEqual(countOccurrences(agentsContent, managedEnd), 0);
  }
}

let passed = 0;
let failed = 0;

console.log('\n=== Testing all MV project stack installs ===\n');

for (const [stack, expected] of Object.entries(stacks)) {
  for (const harness of ['claude', 'codex']) {
    if (test(`${stack} installs actual files for ${harness} and is idempotent`, () => {
      const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), `mv-${stack}-${harness}-`));
      try {
        fs.writeFileSync(path.join(projectDir, 'AGENTS.md'), userAgents);

        const firstResult = runWrapper(projectDir, stack, harness);
        assert.strictEqual(firstResult.status, 0, firstResult.stderr || firstResult.stdout);
        verifyStack(projectDir, stack, harness, expected);
        const firstSnapshot = installedSnapshot(projectDir, harness);

        const secondResult = runWrapper(projectDir, stack, harness);
        assert.strictEqual(secondResult.status, 0, secondResult.stderr || secondResult.stdout);
        verifyStack(projectDir, stack, harness, expected);
        assert.deepStrictEqual(installedSnapshot(projectDir, harness), firstSnapshot);
        if (harness === 'claude') {
          assert.strictEqual(firstSnapshot.agentsContent, userAgents);
        }
      } finally {
        fs.rmSync(projectDir, { recursive: true, force: true });
      }
    })) passed += 1; else failed += 1;
  }
}

if (test('malformed Codex project markers fail before copying any files', () => {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mv-malformed-project-'));
  const agentsPath = path.join(projectDir, 'AGENTS.md');
  const malformedAgents = `${userAgents}\n${managedStart}\nold body\n`;
  try {
    fs.writeFileSync(agentsPath, malformedAgents);

    const result = runWrapper(projectDir, 'react-vite', 'codex');
    assert.notStrictEqual(result.status, 0);
    assert.ok(result.stderr.includes('Error: malformed MV-Platform block'));
    assert.strictEqual(fs.readFileSync(agentsPath, 'utf8'), malformedAgents);
    assert.ok(!fs.existsSync(path.join(projectDir, '.agents')));
  } finally {
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
})) passed += 1; else failed += 1;

for (const harness of ['claude', 'codex']) {
  if (test(`${harness} rejects a symlinked harness directory`, () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), `mv-${harness}-symlink-`));
    const externalDir = fs.mkdtempSync(path.join(os.tmpdir(), `mv-${harness}-outside-`));
    const harnessDirectory = harness === 'codex' ? '.agents' : '.claude';
    try {
      fs.writeFileSync(path.join(projectDir, 'AGENTS.md'), userAgents);
      fs.symlinkSync(
        externalDir,
        path.join(projectDir, harnessDirectory),
        process.platform === 'win32' ? 'junction' : 'dir'
      );

      const result = runWrapper(projectDir, 'react-vite', harness);
      assert.notStrictEqual(result.status, 0);
      assert.deepStrictEqual(fs.readdirSync(externalDir), []);
      assert.strictEqual(
        fs.readFileSync(path.join(projectDir, 'AGENTS.md'), 'utf8'),
        userAgents
      );
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
      fs.rmSync(externalDir, { recursive: true, force: true });
    }
  })) passed += 1; else failed += 1;
}

if (test('Codex rejects a symlinked AGENTS.md without changing its referent', () => {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mv-agents-symlink-'));
  const externalDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mv-agents-outside-'));
  const externalAgents = path.join(externalDir, 'AGENTS.md');
  try {
    fs.writeFileSync(externalAgents, userAgents);
    fs.symlinkSync(externalAgents, path.join(projectDir, 'AGENTS.md'), 'file');

    const result = runWrapper(projectDir, 'react-vite', 'codex');
    assert.notStrictEqual(result.status, 0);
    assert.strictEqual(fs.readFileSync(externalAgents, 'utf8'), userAgents);
    assert.ok(!fs.existsSync(path.join(projectDir, '.agents')));
  } finally {
    fs.rmSync(projectDir, { recursive: true, force: true });
    fs.rmSync(externalDir, { recursive: true, force: true });
  }
})) passed += 1; else failed += 1;

if (test('Codex rejects a symlink inside an existing managed skill directory', () => {
  if (process.platform === 'win32') return;

  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mv-skill-symlink-'));
  const externalDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mv-skill-outside-'));
  const externalSkill = path.join(externalDir, 'SKILL.md');
  const skillDir = path.join(projectDir, '.agents', 'skills', 'frontend-patterns');
  try {
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'AGENTS.md'), userAgents);
    fs.writeFileSync(externalSkill, 'external skill content\n');
    fs.symlinkSync(externalSkill, path.join(skillDir, 'SKILL.md'), 'file');

    const result = runWrapper(projectDir, 'react-vite', 'codex');
    assert.notStrictEqual(result.status, 0);
    assert.strictEqual(fs.readFileSync(externalSkill, 'utf8'), 'external skill content\n');
    assert.ok(!fs.existsSync(path.join(projectDir, '.agents', 'rules')));
  } finally {
    fs.rmSync(projectDir, { recursive: true, force: true });
    fs.rmSync(externalDir, { recursive: true, force: true });
  }
})) passed += 1; else failed += 1;

const hardLinkCases = [
  {
    name: 'Claude managed skill file',
    harness: 'claude',
    relativePath: ['.claude', 'skills', 'frontend-patterns', 'SKILL.md'],
  },
  {
    name: 'Codex managed skill file',
    harness: 'codex',
    relativePath: ['.agents', 'skills', 'frontend-patterns', 'SKILL.md'],
  },
  {
    name: 'Codex managed rule file',
    harness: 'codex',
    relativePath: ['.agents', 'rules', 'ecc', 'common', 'security.md'],
  },
];

for (const hardLinkCase of hardLinkCases) {
  if (test(`${hardLinkCase.name} hard link is rejected without changing its external inode`, () => {
    if (process.platform === 'win32') return;

    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mv-hardlink-project-'));
    const externalDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mv-hardlink-outside-'));
    const externalFile = path.join(externalDir, 'external.md');
    const targetFile = path.join(projectDir, ...hardLinkCase.relativePath);
    const externalContent = 'external content must remain unchanged\n';
    try {
      fs.writeFileSync(path.join(projectDir, 'AGENTS.md'), userAgents);
      fs.writeFileSync(externalFile, externalContent);
      fs.mkdirSync(path.dirname(targetFile), { recursive: true });
      fs.linkSync(externalFile, targetFile);

      const result = runWrapper(projectDir, 'react-vite', hardLinkCase.harness);
      assert.notStrictEqual(result.status, 0);
      assert.ok(result.stderr.includes('hard link'), result.stderr || result.stdout);
      assert.strictEqual(fs.readFileSync(externalFile, 'utf8'), externalContent);
      assert.strictEqual(fs.statSync(externalFile).nlink, 2);
      assert.strictEqual(
        fs.readFileSync(path.join(projectDir, 'AGENTS.md'), 'utf8'),
        userAgents
      );
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
      fs.rmSync(externalDir, { recursive: true, force: true });
    }
  })) passed += 1; else failed += 1;
}

console.log(`\nPassed: ${passed}`);
console.log(`Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
