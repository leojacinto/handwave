# Handwave

Webcam-driven force-directed viewer for the AICT knowledge graph, with Jev's
retire decision for the selected AI system. ServiceNow scope: `x_snc_handwave`.

## Layout

- `client/` — Vite + React + TypeScript graph viewer (runs inside an iframe).
  - `src/lib/gestureController.ts` — MediaPipe hand tracking → pan / zoom / grab / drag / reset.
  - `src/components/GraphCanvas.tsx` — canvas force-directed layout.
  - `src/data/aictKgClient.ts` — queries the native Knowledge Graph (`/api/sn_kg/agentic/safeCypherExecute`, schema `sn_kg.global_graph_mini`, tag `AICT KG Data Agent`).
  - `src/data/jevClient.ts` — sends the loaded graph's governance facts to the Jev endpoint.
- `aiux/` — AIUX app deployed to the instance.
  - `pages/home/page.js` — iframe (graph) + right panel: `sn_grc_ai_gov_ai_system` list and Jev decision box.
  - `pages/home/handwave-embed.js` — inlined client build (generated, see below).
  - `src/fluent/jev.now.ts` — `POST /api/x_snc_handwave/jev/retire` and property `x_snc_handwave.typesafe_api_key`.

## Controls

| Gesture | Mouse | Action |
|---|---|---|
| Pinch a node | Click-drag a node | Drag node |
| Open hand | Drag background | Pan |
| Two-hand pinch, spread/close | Wheel | Zoom |
| Fist | Reset button | Reset view |

Clicking a record in the right-hand list loads that AI system's graph and asks
Jev whether it should be retired.

## Build and deploy

```bash
# 1. Build the client and inline it into the AIUX page
cd client
npm install
npm run build
node scripts/build-embed.mjs
cp handwave-embed.js ../aiux/pages/home/handwave-embed.js

# 2. Build and install the AIUX app
cd ../aiux
pnpm install
npm run build
npm run deploy
```

`aiux/.env` (not committed) holds the target instance:

```
GLIDE_ORIGIN=https://<instance>.service-now.com
AUTH_TOKEN="Basic <base64 user:password>"
```

## First install

Set the TypeSafe API key on the instance (System Properties →
`x_snc_handwave.typesafe_api_key`). Source only has a placeholder; the property
is install-once, so redeploys don't overwrite it.

## Knowledge Graph query notes

`safeCypherExecute` returns null values for `RETURN x.f AS alias` and unreliable
rows when `OPTIONAL MATCH` clauses are chained. The client runs four separate
queries per system (asset, risk, governance detail, profiles) with plain
`RETURN x.f` projections, all filtered on `sn_grc_ai_gov_ai_system.sys_id`.
