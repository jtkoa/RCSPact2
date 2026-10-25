import type { SourceId } from "../data/sources";
import type { HomeownerAnswers, ResearchState } from "./researchTypes";

export type CheckStatus = "PASS" | "FLAG" | "NEEDS_VERIFICATION";

export type RuleState = "retrieved" | "unverified" | "not-applied";

export interface CheckResult {
  id: string;
  title: string;
  status: CheckStatus;
  ruleState: RuleState;
  finding: string;
  evidence: string[];
  missing: string[];
  sourceIds: SourceId[];
}

export interface GeocodeHit {
  lat: number;
  lon: number;
  displayName: string;
  county?: string;
  state?: string;
  city?: string;
  postcode?: string;
}

export interface ParcelFact {
  folio: string;
  siteAddress: string;
  siteCity: string;
  zip: string;
  areaSqFt: number | null;
  rings: number[][][];
}

export interface ZoningFact {
  code: string;
  description: string;
  munc?: string;
}

export interface AddressRecord {
  sourceName: "Miami-Dade GeoProperty";
  operation: "GeoProperty";
  retrievedAt: string;
  folio: string;
  address: string;
  hNum: number;
  preDir: string;
  stName: string;
  stType: string;
  stType2: string;
  sufDir: string;
  subunit: string;
  zip: number | null;
  condoFlg: string;
  cluc: string;
  ttrrss: string;
  cd: number | null;
  pre: number | null;
  trt2000: string;
  grid: string;
  taz: number | null;
  council: number | null;
  subArea: string;
  zone: string;
  floodZone: string;
  floodElev: string;
  x: number | null;
  y: number | null;
}

export interface SiteFacts {
  origin: "search" | "sample";
  sampleId?: string;
  query: string;
  normalizedAddress: string | null;
  geocode: GeocodeHit | null;
  geocodeNote: string | null;
  scope: "miami-dade" | "outside" | "unknown";
  parcel: ParcelFact | null;
  parcelNote: string | null;
  municipality: string | null;
  unincorporated: boolean | null;
  zoning: ZoningFact | null;
  zoningAreas: string[];
  zoningNote: string | null;
  municipalZoning: ZoningFact | null;
  insideUdb: boolean | null;
  cdmpDescriptions: string[];
  primaryZoneDescription: string | null;
  addressRecord: AddressRecord | null;
  addressDisagreement: string | null;
  zoneDisagreement: string | null;
  dataOrigin: "live" | "snapshot" | "none";
  gisErrors: string[];
  retrievedAt: string;
}

export interface ParcelChoice {
  parcel: ParcelFact;
}

export type LookupErrorCode = "unavailable" | "not-found" | "broad" | "county-unknown" | "unconfirmed";

export interface Screening {
  id: string;
  createdAt: string;
  status: "ready" | "outside" | "error" | "choose";
  facts: SiteFacts;
  checks: CheckResult[];
  errorCode?: LookupErrorCode;
  errorTitle?: string;
  errorDetail?: string;
  choices?: ParcelChoice[];
  fallbackFacts?: SiteFacts;
  goal?: string;
  followUpQuestions?: string[];
  modelTurns?: ModelTurn[];
  research?: ResearchState;
  answers?: HomeownerAnswers;
}

export interface ModelTurn {
  question: string;
  answer?: string;
  tools: string[];
  errorCode?: "missing_key" | "model_failed" | "bad_response" | "unavailable";
  errorStatus?: number | null;
}
