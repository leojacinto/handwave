# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with **Handwave**.

Use `AGENTS.md` as the canonical project and ServiceNow AIUX guidance. It contains the cross-agent rules, recommended skills, project conventions, and common commands for this application.

The ServiceNow agent packs are declared in `package.json` dev dependencies. A `postinstall` script copies their skills from `node_modules/@servicenow/agent-pack-*` into `.claude/skills`, then symlinks `.claude/skills` into `.agents/skills` so any agent can read them, automatically on `pnpm install`. Run `pnpm agent:skills` to force a re-copy.

## Skills

| Skill | When to invoke |
| ----- | -------------- |
| `aiux:aiux-build` | **All app work** — pages, routes, layouts, widgets, server scripts, `AIUXElement` patterns, loaders, and deploy pipeline |
| `ui-discovery` | **Before any UI code** — checks reusable platform components and instance widgets |
| `accessibility:accessibility` | Any interactive element, keyboard handling, or ARIA |
| `aiux:internationalization` | Any user-visible string |
| `aiux:localization` | Locale-specific formatting or RTL |
| `horizon-design-knowledge:motion` | Any animation or transition |
