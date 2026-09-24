#!/usr/bin/env node
/**
 * PostToolUse hook — lints the file Claude Code just edited.
 *
 * Reads the hook payload as JSON on stdin, extracts the edited file path, and
 * runs ESLint on just that file using the project's flat config
 * (eslint.config.mjs). This surfaces SSR-safety, accessibility, i18n, and style
 * violations back to Claude in the same turn it made the edit, instead of
 * waiting for a manual `pnpm lint`.
 *
 * Degrades gracefully: if ESLint is not installed yet (e.g. before the first
 * `pnpm install`), the path is not a lintable source file, or it lives in a
 * generated/vendored directory, the hook exits 0 and does nothing — it never
 * blocks a freshly scaffolded project.
 *
 * Exit codes:
 *   0 — clean, not lintable, or ESLint unavailable (no-op)
 *   2 — ESLint found problems; the output on stderr is fed back to Claude
 */
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const SKIP_DIRS = ['node_modules', 'dist', 'dist-metadata', '.now', 'target'];

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf-8');
  } catch {
    return '';
  }
}

let payload;
try {
  payload = JSON.parse(readStdin() || '{}');
} catch {
  process.exit(0); // malformed payload — never block
}

const filePath = payload?.tool_input?.file_path;
if (!filePath || !/\.(mjs|js)$/.test(filePath)) process.exit(0);

// Only lint files inside the project, and skip generated/vendored directories.
const rel = path.relative(projectDir, path.resolve(filePath));
if (
  rel.startsWith('..') ||
  rel.split(path.sep).some(seg => SKIP_DIRS.includes(seg))
) {
  process.exit(0);
}

// Resolve the local ESLint binary; if it's missing, the project hasn't been
// installed yet — skip silently rather than failing the edit.
const isWin = process.platform === 'win32';
const eslintBin = path.join(
  projectDir,
  'node_modules',
  '.bin',
  isWin ? 'eslint.cmd' : 'eslint'
);
if (!fs.existsSync(eslintBin)) process.exit(0);

const result = spawnSync(eslintBin, [rel], {
  cwd: projectDir,
  encoding: 'utf-8',
  shell: isWin
});

if (result.status === 0) process.exit(0);

process.stderr.write(
  `ESLint reported problems in ${rel}:\n${result.stdout || ''}${result.stderr || ''}`
);
process.exit(2);
