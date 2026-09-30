const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.join(__dirname, '..', '..');
const configs = path.join(repoRoot, 'mv-configs');
const roleSkills = fs.readFileSync(path.join(configs, 'role-skills.txt'), 'utf8')
  .trim().split('\n');
const stacks = [
  'react-vite', 'android', 'ios', 'react-native',
  'spring-kotlin', 'fastapi', 'django', 'infra',
];

function skillNames(root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory()
      && fs.existsSync(path.join(root, entry.name, 'SKILL.md')))
    .map(entry => entry.name)
    .sort();
}

function run(script, homeDir, args = []) {
  return spawnSync('bash', [path.join(configs, script), ...args], {
    cwd: repoRoot,
    env: { ...process.env, HOME: homeDir },
    encoding: 'utf8',
  });
}

const projectScript = fs.readFileSync(path.join(configs, 'install-project.sh'), 'utf8');
const stackUnion = new Set();
for (const stack of stacks) {
  const block = projectScript.match(new RegExp(`^  ${stack}\\)\\n([\\s\\S]*?)^    ;;`, 'm'));
  assert.ok(block, `missing stack: ${stack}`);
  const skills = block[1].match(/SKILLS\+=\(([\s\S]*?)\)/);
  assert.ok(skills, `missing skills: ${stack}`);
  for (const skill of skills[1].match(/[a-z][a-z0-9-]+/g) || []) stackUnion.add(skill);
}
assert.strictEqual(roleSkills.length, 38);
assert.strictEqual(new Set(roleSkills).size, 38);
assert.deepStrictEqual([...roleSkills].sort(), [...stackUnion].sort());

for (const target of ['claude', 'codex']) {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), `mv-unified-${target}-`));
  const script = target === 'claude' ? 'install-unified.sh' : 'install-unified-codex.sh';
  const skillsRoot = path.join(homeDir, target === 'claude' ? '.claude' : '.agents', 'skills');
  try {
    if (target === 'claude') {
      fs.mkdirSync(path.join(homeDir, '.claude'));
      fs.writeFileSync(path.join(homeDir, '.claude', 'settings.json'),
        JSON.stringify({ enabledPlugins: { 'ecc@ecc': false } }));
    }
    const dryRun = run(script, homeDir, ['--dry-run']);
    assert.strictEqual(dryRun.status, 0, dryRun.stderr || dryRun.stdout);
    assert.deepStrictEqual(skillNames(skillsRoot), []);

    const first = run(script, homeDir);
    assert.strictEqual(first.status, 0, first.stderr || first.stdout);
    const names = skillNames(skillsRoot);
    assert.strictEqual(names.length, 49);
    assert.ok(names.includes('continuous-learning-v2'));
    assert.ok(!names.includes('continuous-learning'));
    assert.ok(names.includes('accessibility'));
    assert.ok(names.includes('safety-guard'));

    const second = run(script, homeDir);
    assert.strictEqual(second.status, 0, second.stderr || second.stdout);
    assert.deepStrictEqual(skillNames(skillsRoot), names);
    if (target === 'claude') {
      const settings = JSON.parse(fs.readFileSync(
        path.join(homeDir, '.claude', 'settings.json'), 'utf8'));
      assert.strictEqual(settings.enabledPlugins['ecc@ecc'], false);
    }
    console.log(`✓ ${target}: dry-run, 49 unique skills, plugin state, reinstall`);
  } finally {
    fs.rmSync(homeDir, { recursive: true, force: true });
  }
}
