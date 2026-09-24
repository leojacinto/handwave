import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const skillSources = [
  '@servicenow/agent-pack-aiux',
  '@servicenow/agent-pack-horizon-design-knowledge'
];
const targetDir = path.join(rootDir, '.claude', 'skills');

// Deprecated in favor of aiux-build — never copy these into a scaffolded app.
const deprecatedSkills = new Set(['aiux-app', 'aiux-element', 'aiux-widget']);

// Copy one pack's skills into .claude/skills and return how many were copied.
// A missing pack is skipped rather than fatal: this script runs as a
// `postinstall` hook, so it must never fail `pnpm install` — e.g. a
// production/CI install (`--prod`, `--ignore-scripts` aside) that prunes the
// dev-dependency packs should still succeed.
function copySkills(packageName) {
  const skillsDir = path.join(rootDir, 'node_modules', packageName, 'skills');
  if (!fs.existsSync(skillsDir)) return 0;

  fs.mkdirSync(targetDir, {recursive: true});
  let count = 0;
  for (const entry of fs.readdirSync(skillsDir, {withFileTypes: true})) {
    if (!entry.isDirectory()) continue;
    if (deprecatedSkills.has(entry.name)) continue;
    fs.cpSync(
      path.join(skillsDir, entry.name),
      path.join(targetDir, entry.name),
      {recursive: true, force: true}
    );
    count++;
  }
  return count;
}

let total = 0;
for (const packageName of skillSources) total += copySkills(packageName);

// Retired skills, mapped to the skill that replaces them. copySkills only
// touches directories the current pack still ships, so a retired skill's
// directory is never removed on its own — it would sit in .claude/skills
// forever. Left there, it competes with its replacement: an agent scanning
// available skills can invoke the retired one instead, and its content is
// now frozen (no longer generated), so it silently goes stale. Only remove
// it once the replacement is actually present, so a pruned/offline install
// that shipped neither never leaves a project with no skill at all.
const retiredSkills = {'component-discovery': 'ui-discovery'};
for (const [oldName, newName] of Object.entries(retiredSkills)) {
  const oldDir = path.join(targetDir, oldName);
  if (fs.existsSync(oldDir) && fs.existsSync(path.join(targetDir, newName))) {
    fs.rmSync(oldDir, {recursive: true, force: true});
    console.log(
      `Removed retired skill '${oldName}' (superseded by '${newName}')`
    );
  }
}

const uiDiscoverySetup = path.join(
  targetDir,
  'ui-discovery',
  'scripts',
  'setup-ui-discovery.mjs'
);
if (fs.existsSync(uiDiscoverySetup)) {
  try {
    execFileSync(process.execPath, [uiDiscoverySetup], {
      cwd: rootDir,
      stdio: 'inherit'
    });
  } catch (error) {
    console.warn(`Could not restore the UI discovery index: ${error.message}`);
  }
}

// Create .agents/skills -> .claude/skills link so other agents discover the
// same skills without a separate copy. Only when .claude/skills actually
// exists — e.g. a --prod install that pruned the agent-pack devDeps never
// populated it, and a link to a nonexistent directory would just dangle.
//
// POSIX: a relative symlink (portable across machines/checkouts).
// Windows: symlinks need Administrator privileges or Developer Mode enabled,
// which most users don't have — use a directory junction instead, which
// needs neither (but requires an absolute target).
const agentsSkillsLink = path.join(rootDir, '.agents', 'skills');
const isWindows = process.platform === 'win32';
const agentsLinkTarget = isWindows
  ? targetDir
  : path.join('..', '.claude', 'skills');
const linkType = isWindows ? 'junction' : undefined;
const linkKind = isWindows ? 'junction' : 'symlink';
if (fs.existsSync(targetDir)) {
  try {
    const existing = fs.lstatSync(agentsSkillsLink);
    if (
      existing.isSymbolicLink() &&
      fs.readlinkSync(agentsSkillsLink) === agentsLinkTarget
    ) {
      // Already correct — nothing to do.
    } else {
      fs.rmSync(agentsSkillsLink, {recursive: true, force: true});
      fs.mkdirSync(path.dirname(agentsSkillsLink), {recursive: true});
      fs.symlinkSync(agentsLinkTarget, agentsSkillsLink, linkType);
      console.log(`Updated .agents/skills ${linkKind} → .claude/skills`);
    }
  } catch {
    fs.mkdirSync(path.dirname(agentsSkillsLink), {recursive: true});
    fs.symlinkSync(agentsLinkTarget, agentsSkillsLink, linkType);
    console.log(`Created .agents/skills ${linkKind} → .claude/skills`);
  }
}

if (total > 0) {
  console.log(
    `Copied ${total} ServiceNow agent skill(s) to ${path.relative(rootDir, targetDir)}`
  );
} else {
  console.log(
    'ServiceNow agent packs not found in node_modules — skipping skill copy. ' +
      'They are copied automatically on `pnpm install`; run `pnpm agent:skills` to retry.'
  );
}
