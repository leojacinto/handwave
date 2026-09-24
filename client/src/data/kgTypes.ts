export type KgNodeType = "system" | "model" | "prompt" | "flag" | "detail";

export interface KgNode {
  id: string;
  label: string;
  type: KgNodeType;
  status?: string;
  lastCertificationDate?: string;
  relatedAiSystem?: string;
  complianceScore?: string;
  riskRating?: string;
  // Real-record identity, set only when this node was built from a live
  // ServiceNow record — lets a UI action (e.g. pinch) open the actual
  // record. Absent on derived nodes with no single backing row.
  recordTable?: string;
  recordSysId?: string;
}

export interface KgLink {
  source: string;
  target: string;
  kind: "governs" | "flagged_by" | "certified_on";
}

export interface KgGraph {
  nodes: KgNode[];
  links: KgLink[];
}
