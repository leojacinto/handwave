import type { KgGraph, KgNode, KgLink } from "./kgTypes";

// Real wiring against the actual native Knowledge Graph engine — not a
// Table API shortcut. Confirmed live against the demo instance:
//   POST /api/sn_kg/agentic/safeCypherExecute
//   body: { cypher, result_limit, assistantConfig: { assistantAttributes: {
//     knowledge_graph_nlq_schema: "sn_kg.global_graph_mini",
//     knowledge_graph_nlq_tags: ["AICT KG Data Agent"] // same tag jev's real
//                                                        // AI Agent Studio tool uses
//   } } }
// getSchema (same base) confirmed this schema's real relationships:
//   (sn_grc_ai_gov_ai_system)-[:ai_system_digital_asset]->(alm_ai_digital_asset)
//   (sn_grc_ai_gov_ai_system)-[:risk_rollup_result]->(sn_grc_ai_gov_risk_assessment_result)
// Each Cypher result row is keyed by TABLE NAME (not the Cypher alias), each
// field as { value, displayValue }.
//
// This runs inside handwave's iframe (see pages/home/page.js), same-origin
// with no <base>, so relative fetch() hits the instance directly. Unlike the
// GET reads this replaced, this is a POST — ServiceNow's XSRF check may
// require the X-UserToken the parent page's own scripts hold (g_ck), which
// this isolated srcdoc document has no access to. Not verified live in a
// real browser session; falls back to mock on any failure so the app never
// breaks, but if you see "MOCK DATA" here, this XSRF gap is the first thing
// to check.

// A single verified real governance system ("Microsoft AI News Aggregator
// 1.0") picked live via safeCypherExecute for having a genuinely varied,
// medium-sized neighborhood — risk assessment + governance detail + 3
// distinct entity-map profiles (7 real nodes) — not because it's special
// otherwise. A broad, unfiltered query was tried first and rejected: 291 of
// 291 sampled assets had exactly 3 nodes (system+risk+one detail), so
// "richest wins" just surfaces rare 25-duplicate outliers or near-empty
// ones — neither is representative. This is a deliberate, checked choice.
const FOCUS_GOV_SYS_ID = "a0dff28b61242a10f877f526aa2a4ac2";

// sn_kg's safeCypherExecute has no parameter binding — the id goes straight
// into the query string, so this must be enforced before interpolation.
const SYS_ID_RE = /^[0-9a-f]{32}$/i;

// Verified live 2026-09-24: `RETURN x.f AS alias` makes every value come back
// null under a `_computed_results` key, and chaining OPTIONAL MATCHes returns
// unrelated rows for most systems. Plain `RETURN x.f` projections in separate
// single-relationship queries return correct, table-keyed rows for every
// record tested. Whole-node RETURN is avoided: r's currency fields NPE the
// server.
function systemQueries(govSysId: string) {
  const s = `MATCH (s:sn_grc_ai_gov_ai_system) WHERE s.sys_id = '${govSysId}'`;
  return {
    asset: `${s} MATCH (s)-[:ai_system_digital_asset]->(a:alm_ai_digital_asset) RETURN s.sys_id, s.number, s.state, a.sys_id, a.display_name, a.sys_class_name LIMIT 5`,
    risk: `${s} MATCH (s)-[:risk_rollup_result]->(r:sn_grc_ai_gov_risk_assessment_result) RETURN r.sys_id, r.residual_rating_display, r.inherent_rating_display LIMIT 5`,
    detail: `${s} MATCH (s)-[:ai_system_digital_asset]->(a:alm_ai_digital_asset) MATCH (gd:sn_ai_governance_asset_governance_details)-[:asset]->(a) RETURN gd.sys_id, gd.asset_status, gd.completeness_score LIMIT 5`,
    profiles: `${s} MATCH (m:sn_grc_ai_gov_ai_system_entity_map)-[:ai_system]->(s) MATCH (m)-[:entity]->(p:sn_grc_profile) RETURN p.sys_id, p.name LIMIT 20`,
  };
}

interface RawField {
  value: string | null;
  displayValue: string | null;
}
type RawRow = Record<string, Record<string, RawField> | null>;

function getXsrfHeaders(): Record<string, string> {
  // Same-origin srcdoc iframe: window.parent is the real AIUX page, which
  // does have g_ck set by the platform — mirrors context-graph's
  // kgService.ts getHeaders(), just read one frame up.
  const parentWindow = window.parent as unknown as { g_ck?: string; g_user_token?: string };
  const token = parentWindow.g_ck || parentWindow.g_user_token || "";
  return { "X-UserToken": token };
}

async function runCypher(cypher: string): Promise<RawRow[]> {
  const res = await fetch("/api/sn_kg/agentic/safeCypherExecute", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...getXsrfHeaders() },
    body: JSON.stringify({
      cypher,
      result_limit: 300,
      assistantConfig: {
        assistantAttributes: {
          knowledge_graph_nlq_schema: "sn_kg.global_graph_mini",
          knowledge_graph_nlq_tags: ["AICT KG Data Agent"],
        },
      },
    }),
  });
  if (!res.ok) throw new Error(`safeCypherExecute failed: ${res.status}`);
  const body = (await res.json()) as { result?: { ok?: boolean; results?: RawRow[]; error?: string } };
  if (!body.result?.ok) throw new Error(body.result?.error || "Cypher query did not succeed");
  return body.result.results || [];
}

async function fetchSystemGraph(govSysId: string): Promise<KgGraph> {
  const q = systemQueries(govSysId);
  const [assetRows, riskRows, detailRows, profileRows] = await Promise.all([
    runCypher(q.asset),
    runCypher(q.risk),
    runCypher(q.detail),
    runCypher(q.profiles),
  ]);

  const nodes = new Map<string, KgNode>();
  const links: KgLink[] = [];

  const assetRow = assetRows[0];
  const asset = assetRow?.["alm_ai_digital_asset"];
  const gov = assetRow?.["sn_grc_ai_gov_ai_system"];
  const assetId = asset?.sys_id?.value;
  if (!asset || !assetId) return { nodes: [], links: [] };

  const assetClass = asset.sys_class_name?.displayValue || "";
  // recordSysId is the asset's own sys_id, used by the pinch-to-open action.
  nodes.set(assetId, {
    id: assetId,
    label: asset.display_name?.displayValue || gov?.number?.displayValue || assetId,
    type: /model/i.test(assetClass) ? "model" : /prompt/i.test(assetClass) ? "prompt" : "system",
    status: gov?.state?.displayValue ?? undefined,
    recordTable: "alm_ai_digital_asset",
    recordSysId: assetId,
  });

  for (const row of riskRows) {
    const risk = row["sn_grc_ai_gov_risk_assessment_result"];
    const riskSysId = risk?.sys_id?.value;
    if (!riskSysId) continue;
    const riskId = `risk-${riskSysId}`;
    if (nodes.has(riskId)) continue;
    const rating =
      risk.residual_rating_display?.displayValue || risk.inherent_rating_display?.displayValue || "Unrated";
    nodes.set(riskId, {
      id: riskId,
      label: rating,
      type: "flag",
      riskRating: rating,
      recordTable: "sn_grc_ai_gov_risk_assessment_result",
      recordSysId: riskSysId,
    });
    links.push({ source: assetId, target: riskId, kind: "flagged_by" });
  }

  // asset_status is the one reliably human-readable field on this table;
  // evaluation_status often decodes to a raw numeric code.
  for (const row of detailRows) {
    const detail = row["sn_ai_governance_asset_governance_details"];
    const detailId = detail?.sys_id?.value;
    if (!detailId || !detail.asset_status?.displayValue || nodes.has(detailId)) continue;
    nodes.set(detailId, {
      id: detailId,
      label: detail.asset_status.displayValue,
      type: "detail",
      complianceScore: detail.completeness_score?.displayValue ?? undefined,
      recordTable: "sn_ai_governance_asset_governance_details",
      recordSysId: detailId,
    });
    links.push({ source: assetId, target: detailId, kind: "governs" });
  }

  for (const row of profileRows) {
    const profile = row["sn_grc_profile"];
    const profileId = profile?.sys_id?.value;
    if (!profileId || nodes.has(profileId)) continue;
    nodes.set(profileId, {
      id: profileId,
      label: profile.name?.displayValue || profileId,
      type: "detail",
      recordTable: "sn_grc_profile",
      recordSysId: profileId,
    });
    links.push({ source: assetId, target: profileId, kind: "governs" });
  }

  return { nodes: Array.from(nodes.values()), links };
}

// No mock fallback: real data from the live Knowledge Graph engine or throw.
export async function fetchAictGraph(): Promise<KgGraph> {
  const graph = await fetchSystemGraph(FOCUS_GOV_SYS_ID);
  if (graph.nodes.length === 0) throw new Error("Knowledge Graph query returned no nodes");
  return graph;
}

// govSysId must be the clicked row's own sn_grc_ai_gov_ai_system sys_id
// (page.js's listSysId), not the asset it references.
export async function fetchAictGraphForSystem(govSysId: string): Promise<KgGraph> {
  if (!SYS_ID_RE.test(govSysId)) throw new Error(`Invalid sys_id: ${govSysId}`);
  const graph = await fetchSystemGraph(govSysId);
  if (graph.nodes.length === 0) throw new Error("Knowledge Graph query returned no nodes for that record");
  return graph;
}
