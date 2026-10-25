import { assess } from "../engine/assess";
import type { ParcelFact, Screening } from "../engine/types";
import { normalizeStreet } from "./address";
import { confirmParcel, lookupAddress } from "./gis";

const KEY = "rcsp.screenings.v1";

function readAll(): Record<string, Screening> {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, Screening>) : {};
  } catch {
    return {};
  }
}

export function saveScreening(screening: Screening) {
  const all = readAll();
  all[screening.id] = screening;
  sessionStorage.setItem(KEY, JSON.stringify(all));
}

function hydrate(screening: Screening): Screening {
  const facts = screening.facts;
  facts.addressRecord ??= null;
  facts.primaryZoneDescription ??= null;
  facts.addressDisagreement ??= null;
  facts.zoneDisagreement ??= null;
  facts.zoningAreas ??= facts.zoning?.code ? [facts.zoning.code] : [];
  facts.gisErrors ??= [];
  facts.cdmpDescriptions ??= [];
  return screening;
}

export function loadScreening(id: string): Screening | null {
  const screening = readAll()[id];
  return screening ? hydrate(screening) : null;
}

export async function beginScreening(input: {
  query: string;
  origin: "search" | "sample";
  sampleId?: string;
}): Promise<Screening> {
  const normalized = normalizeStreet(input.query);
  const result = await lookupAddress({
    query: input.query.trim(),
    origin: input.origin,
    sampleId: input.sampleId,
    normalizedAddress: normalized,
  });
  const screening: Screening = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: result.kind === "ready" ? "ready" : result.kind,
    facts: result.facts,
    checks: result.kind === "ready" ? assess(result.facts) : [],
    choices: result.kind === "choose" ? result.choices.map((parcel) => ({ parcel })) : undefined,
    errorCode: result.kind === "error" ? result.code : undefined,
    errorTitle: result.kind === "error" ? result.title : undefined,
    errorDetail: result.kind === "error" ? result.detail : undefined,
    fallbackFacts: result.kind === "error" ? result.fallback : undefined,
  };
  saveScreening(screening);
  return screening;
}

export async function selectParcel(screening: Screening, parcel: ParcelFact): Promise<Screening> {
  const result = await confirmParcel(screening.facts, parcel);
  if (result.kind !== "ready") {
    const next: Screening = {
      ...screening,
      status: result.kind === "choose" ? "choose" : result.kind,
      facts: result.facts,
      checks: [],
      errorCode: result.kind === "error" ? result.code : undefined,
      errorTitle: result.kind === "error" ? result.title : undefined,
      errorDetail: result.kind === "error" ? result.detail : undefined,
      fallbackFacts: result.kind === "error" ? result.fallback : undefined,
    };
    saveScreening(next);
    return next;
  }
  const next: Screening = {
    ...screening,
    status: "ready",
    facts: result.facts,
    checks: assess(result.facts),
    choices: undefined,
    errorCode: undefined,
    errorTitle: undefined,
    errorDetail: undefined,
    fallbackFacts: undefined,
  };
  saveScreening(next);
  return next;
}

export function updateScreening(
  screening: Screening,
  patch: Partial<Pick<Screening, "goal" | "followUpQuestions" | "modelTurns" | "research" | "answers">>,
): Screening {
  const next = { ...screening, ...patch };
  saveScreening(next);
  return next;
}
