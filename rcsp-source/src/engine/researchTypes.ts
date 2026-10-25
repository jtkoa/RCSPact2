export const researchSteps = ["sketch", "permits", "overlays", "cases", "code", "lot-fields"] as const;

export type ResearchStep = (typeof researchSteps)[number];

export interface SketchEvidence {
  ok: boolean;
  httpStatus: number | null;
  url: string;
  retrievedAt: string;
  address: string | null;
  actualSqFt: number | null;
  livingSqFt: number | null;
  adjustedSqFt: number | null;
  matchedFolio: boolean;
  error: "http" | "timeout" | "parse" | "mismatch" | null;
}

export interface PermitEvidence {
  ok: boolean;
  httpStatus: number | null;
  url: string;
  retrievedAt: string;
  folioMatches: number | null;
  addressMatches: number | null;
  pointMatches: number | null;
  error: "http" | "timeout" | null;
}

export interface OverlayEvidence {
  ok: boolean;
  retrievedAt: string;
  zoneOverlay: string | null;
  zoneDescription: string | null;
  wellfieldName: string | null;
  wetlandCount: number | null;
  urbanCenterCount: number | null;
  rapidTransitCount: number | null;
  landUse: string | null;
  failedLayers: string[];
  urls: Array<{ title: string; url: string }>;
}

export interface CaseEvidence {
  ok: boolean;
  httpStatus: number | null;
  retrievedAt: string;
  hearings: number | null;
  plats: number | null;
  hearingUrl: string;
  platUrl: string;
  error: "http" | "timeout" | null;
}

export interface CodeEvidence {
  retrievedAt: string;
  municodeStatus: number | null;
  section28Status: number | null;
  aduPageStatus: number | null;
  statuteStatus: number | null;
  zoneTableDescription: string | null;
  zoneTableFields: string[];
  zoneTableStatus: number | null;
  municodeUrl: string;
  section28Url: string;
  aduUrl: string;
  statuteUrl: string;
  zoneTableUrl: string;
  lotMinPublished: boolean;
  ruSizePublished: boolean;
  setbackMentioned: boolean;
  heightMentioned: boolean;
  statuteAffidavit: boolean;
  eligibilityDistrictsPublished: boolean;
  occupancyLimitPublished: boolean;
  parkingRulePublished: boolean;
  separateSalePublished: boolean;
  frontPlacementProhibited: boolean;
  hoaNoticePublished: boolean;
  permitRequiredPublished: boolean;
  recoverySource: "" | "county-adu-page";
  recoveryUrl: string;
}

export interface LotFieldEvidence {
  ok: boolean;
  httpStatus: number | null;
  url: string;
  retrievedAt: string;
  fieldNames: string[];
  hasWidthOrDepth: boolean;
  error: "http" | "timeout" | null;
}

export interface ResearchState {
  sketch?: SketchEvidence;
  permits?: PermitEvidence;
  overlays?: OverlayEvidence;
  cases?: CaseEvidence;
  code?: CodeEvidence;
  lotFields?: LotFieldEvidence;
}

export function researchKey(step: ResearchStep): keyof ResearchState {
  if (step === "lot-fields") return "lotFields";
  return step;
}

export interface HomeownerAnswers {
  proposedSqFt: number | null;
  sizeUnsure: boolean;
  placement: "behind" | "in-front" | "unsure";
  parking: "on-site" | "street" | "unsure";
  bedrooms: number | null;
  bedroomsUnsure: boolean;
}
