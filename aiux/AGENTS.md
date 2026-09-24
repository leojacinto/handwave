# AGENTS.md

Guidance for AI coding agents working in **Handwave**.

## Start Here

Use `AGENTS.md` as the canonical guidance file for coding agents such as Claude Code, Gemini CLI, Codex, Cascade, and other repository-aware assistants. Tool-specific files such as `CLAUDE.md` and `GEMINI.md` should point back here instead of duplicating project rules.

## Mandatory UI Edit Checklist

For any request that involves building or updating UI:

1. Invoke the `ui-discovery` skill first — before writing code or making a plan.
2. Evaluate reusable components and instance widgets together. If a candidate exists, use the best match and proceed without asking for confirmation.

Use the ServiceNow AIUX skills before changing app code:

- `ui-discovery` — see Mandatory UI Edit Checklist above
- `aiux:aiux-build` for pages, routes, layouts, widgets, server scripts, `AIUXElement` lifecycle/decorators/loaders/context patterns, and deploy pipeline work
- `accessibility:accessibility` for accessibility audits and fixes

The ServiceNow agent packs are declared in `package.json` dev dependencies, so they install with the project. A `postinstall` script copies the packs' skills from `node_modules/@servicenow/agent-pack-*` into `.claude/skills`, then symlinks `.claude/skills` into `.agents/skills` so any agent can read them — automatically on every `pnpm install`, no manual step, and it works for any agent rather than relying on a Claude-specific hook. Run `pnpm agent:skills` to force a re-copy (e.g. after editing a skill, or if you installed with `--ignore-scripts`).

## Project Rules

- Components extend `AIUXElement` from `@servicenow/aiux/aiux-components-core`, never `LitElement`
- Guard browser globals with `isServer` from `lit`
- Use Tailwind + DaisyUI for styling; no `--now-*` CSS tokens
- Keep `aiux.json#basename` and `package.json#aiux.basename` aligned
- Prefer `pnpm build` before deploy

## Commands

```bash
pnpm dev
pnpm build
pnpm lint
pnpm deploy
```
