# Handwave

Minority Report-style, webcam-driven force-directed graph viewer for the AICT
knowledge graph. Pinch a node to drag it, move an open hand to pan, pinch with
both hands and spread/close to zoom, make a fist to reset the view.

Target scope on the instance: `x_snc_handwave`.

## Status: Phase 1 (this repo today)

`client/` is a standalone Vite + React + TypeScript app, fully working right
now against **mock data** — no ServiceNow instance required:

- `src/lib/gestureController.ts` — wraps `@mediapipe/tasks-vision`
  `HandLandmarker` (loaded from Google's/jsdelivr's CDN, nothing self-hosted),
  classifies each hand as `open` / `pinch` / `fist` per frame from landmark
  geometry, and turns that into `pan` / `zoom` / `grab` / `drag` / `release` /
  `reset` actions.
- `src/components/GraphCanvas.tsx` — canvas force-directed layout (repulsion +
  link attraction + collision + center gravity, no external graph library),
  adapted from `context-graph`'s `GraphView.tsx`, with an imperative handle
  (`pan`, `zoomAt`, `beginDragAt`, `dragTo`, `endDrag`, `reset`) so both
  gestures and a plain mouse can drive it.
- `src/components/HandOverlay.tsx` — webcam feed + glowing hand-skeleton
  overlay, mirrored so movement feels natural.
- `src/data/mockAictGraph.ts` — placeholder graph shaped after the governance
  facts jev's "AI Asset Maintenance Advisor" agent already queries for
  (`status`, `last_certification_date`, `compliance_flags`,
  `related_ai_system`): AI systems → models/prompts → compliance flags.

Verified end-to-end with a real camera feed via Playwright: hand detection,
skeleton overlay, gesture classification (`LEFT · OPEN` etc.), and mouse-driven
pan/zoom/drag all render correctly. Gesture thresholds
(`PINCH_RATIO`/`FIST_RATIO`/`OPEN_RATIO` in `gestureController.ts`) were tuned
by eye against that one clip, not a range of hands/lighting — expect to retune
after trying it live.

### Run it

```bash
cd client
npm install   # already done
npm run dev   # already running at http://localhost:5173
```

Open it, click "Enable camera", grant webcam access, and try the gestures.
Everything runs client-side; nothing leaves the browser tab.

## Status: Phase 2 (not started — needs you)

The real AICT knowledge graph isn't exposed as an API anywhere yet. `jev`
(`AGL AICT and ADA/jev`) only has a server-side AI Agent Studio tool ("AICT
Knowledge Graph Lookup", `sn_aia_agent_tool_m2m` `fa0cd8803be74b10cedd7ea693e45a06`)
that calls the *native* Knowledge Graph engine with
`knowledge_graph: "global_graph_mini"` and `tags: ["AICT KG Data Agent"]` — no
credentials for that instance live in this repo or any repo I
checked, on purpose, matching jev's own "credentials via env vars only" rule.

To wire this up for real, next steps are:

1. You give me the instance URL + credentials (or run
   `now-sdk auth` yourself), the same way jev's README documents.
2. Run `now-sdk init` in this repo to create the real `x_snc_handwave` scoped
   app and get a real `scopeId` for `now.config.json` — I won't fabricate one.
3. Build a Scripted REST API in that scope (e.g.
   `/api/x_snc_handwave/aict_kg/graph`) that calls the native Knowledge Graph
   engine the same way the AICT KG Data Agent tool does, and returns
   `{ nodes, links }` shaped like `client/src/data/mockAictGraph.ts`'s
   `KgGraph` — mirroring how `context-graph`'s `forecast_kg_native_nlq`
   REST API wraps `NLQVisualization`.
4. Swap `client/src/data/aictKgClient.ts`'s `fetchAictGraph()` to call that
   endpoint instead of returning `mockAictGraph`, and package `client/` as
   the scoped app's UI page (again following `context-graph`'s
   `src/fluent/ui-pages/forecast-kg-page.now.ts` pattern).

I deliberately didn't scaffold a `now.config.json` / Fluent source tree for
this yet — without a real instance to point at, `now-sdk build` can't be
verified, and a Fluent scaffold I can't build is worse than no scaffold.
