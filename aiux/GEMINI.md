# GEMINI.md

This file provides guidance to Gemini CLI and Gemini-based coding agents when working with **Handwave**.

Use `AGENTS.md` as the canonical project and ServiceNow AIUX guidance. It contains the cross-agent rules, recommended skills, project conventions, and common commands for this application.

The ServiceNow agent packs are declared in `package.json` dev dependencies. A `postinstall` script copies their skills from `node_modules/@servicenow/agent-pack-*` into `.claude/skills`, then symlinks `.claude/skills` into `.agents/skills` so any agent can read them, automatically on `pnpm install`. Run `pnpm agent:skills` to force a re-copy.
