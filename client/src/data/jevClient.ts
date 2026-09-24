import type { KgGraph } from "./kgTypes";

export interface JevFact {
  key: string;
  value: string;
}

export interface JevDecision {
  label: string;
  retire: boolean;
  probability: number;
  model?: string;
  facts: JevFact[];
}

// The same governance facts jev's agent passes as `state` (key=value pairs),
// taken from the KG graph already on screen.
function factsFromGraph(graph: KgGraph): { label: string; facts: JevFact[] } | null {
  const asset = graph.nodes.find((n) => n.recordTable === "alm_ai_digital_asset");
  if (!asset) return null;
  const risk = graph.nodes.find((n) => n.recordTable === "sn_grc_ai_gov_risk_assessment_result");
  const detail = graph.nodes.find((n) => n.recordTable === "sn_ai_governance_asset_governance_details");
  const profiles = graph.nodes.filter((n) => n.recordTable === "sn_grc_profile").length;
  const facts: JevFact[] = [
    { key: "asset_type", value: asset.type },
    { key: "governance_state", value: asset.status || "unknown" },
    { key: "residual_risk_rating", value: risk?.riskRating || "none" },
    { key: "asset_status", value: detail?.label || "none" },
    { key: "completeness_score", value: detail?.complianceScore || "none" },
    { key: "linked_profiles", value: String(profiles) },
  ];
  return { label: asset.label, facts };
}

export async function askJevRetire(graph: KgGraph): Promise<JevDecision> {
  const input = factsFromGraph(graph);
  if (!input) throw new Error("No AI asset in this graph to ask Jev about");
  const parentWindow = window.parent as unknown as { g_ck?: string; g_user_token?: string };
  const res = await fetch("/api/x_snc_handwave/jev/retire", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-UserToken": parentWindow.g_ck || parentWindow.g_user_token || "",
    },
    body: JSON.stringify({
      label: input.label,
      state: input.facts.map((f) => `${f.key}=${f.value}`).join("; "),
    }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    result?: { retire?: boolean; probability?: number; model?: string; error?: string };
    error?: { message?: string };
  };
  const result = body.result;
  if (!res.ok || !result || typeof result.probability !== "number") {
    throw new Error(result?.error || body.error?.message || `Jev request failed: ${res.status}`);
  }
  return {
    label: input.label,
    retire: !!result.retire,
    probability: result.probability,
    model: result.model,
    facts: input.facts,
  };
}
