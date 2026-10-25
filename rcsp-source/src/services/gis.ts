import type { AddressRecord, GeocodeHit, ParcelFact, SiteFacts, ZoningFact } from "../engine/types";
import { countyIsMiamiDade, miamiDadeGeocodeHint, normalizeStreet } from "./address";
import { cleanText, isUnincorporatedName } from "../engine/text";
import { snapshotFacts } from "../data/snapshots";
import { AddressServiceError, fetchGeoProperty } from "./geoproperty";
import { serviceUrl } from "./serviceUrl";

const PARCEL = "/gis/land/MD_ZoningLandManagementData/MapServer/3/query";
const MUNI = "/gis/land/MD_ZoningLandManagementData/MapServer/7/query";
const CDMP = "/gis/land/MD_ZoningLandManagementData/MapServer/11/query";
const CITY_ZONE = "/gis/land/MD_Zoning/MapServer/2/query";
const ZONE = "/gis/pa/MD_PA_PropertySearch/MapServer/4/query";
const PRIMARY_ZONE = "/gis/pa/MD_PA_PropertySearch/MapServer/9/query";
const UDB = "/gis/pa/MD_PA_PropertySearch/MapServer/17/query";

interface GisFeature {
  attributes: Record<string, unknown>;
  geometry?: { rings?: number[][][] };
}

interface GisPayload {
  features?: GisFeature[];
  error?: { message?: string };
}

async function postQuery(path: string, params: Record<string, string>, signal: AbortSignal): Promise<GisPayload> {
  const response = await fetch(serviceUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
    signal,
  });
  if (!response.ok) {
    throw new Error(`${response.status} from county GIS`);
  }
  const payload = (await response.json()) as GisPayload;
  if (payload.error) {
    throw new Error(payload.error.message || "County GIS rejected the query");
  }
  return payload;
}

function areaOf(attributes: Record<string, unknown>): number | null {
  const raw = attributes["Shape.STArea()"] ?? attributes["SHAPE.STArea()"];
  const value = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(value) ? value : null;
}

function parcelFromFeature(feature: GisFeature): ParcelFact | null {
  const attributes = feature.attributes;
  const siteAddress = cleanText(String(attributes.TRUE_SITE_ADDR ?? ""));
  const folio = cleanText(String(attributes.FOLIO ?? ""));
  const rings = feature.geometry?.rings ?? [];
  if (!siteAddress || !folio || rings.length === 0) return null;
  return {
    folio,
    siteAddress,
    siteCity: cleanText(String(attributes.TRUE_SITE_CITY ?? "")),
    zip: cleanText(String(attributes.TRUE_SITE_ZIP_CODE ?? "")),
    areaSqFt: areaOf(attributes),
    rings,
  };
}

export async function queryParcels(where: string): Promise<ParcelFact[]> {
  const signal = AbortSignal.timeout(8000);
  const payload = await postQuery(
    PARCEL,
    {
      where,
      outFields: "FOLIO,TRUE_SITE_ADDR,TRUE_SITE_CITY,TRUE_SITE_ZIP_CODE,Shape.STArea()",
      returnGeometry: "true",
      outSR: "4326",
      resultRecordCount: "8",
      f: "json",
    },
    signal,
  );
  return (payload.features ?? []).map(parcelFromFeature).filter((item): item is ParcelFact => item != null);
}

function spatialBody(rings: number[][][], outFields: string): Record<string, string> {
  return {
    geometry: JSON.stringify({ rings, spatialReference: { wkid: 4326 } }),
    geometryType: "esriGeometryPolygon",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields,
    returnGeometry: "false",
    f: "json",
  };
}

function pointBody(lon: number, lat: number, outFields: string): Record<string, string> {
  return {
    geometry: `${lon},${lat}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields,
    returnGeometry: "false",
    f: "json",
  };
}

async function featuresAt(
  path: string,
  rings: number[][][],
  outFields: string,
  signal: AbortSignal,
): Promise<GisFeature[]> {
  try {
    const payload = await postQuery(path, spatialBody(rings, outFields), signal);
    return payload.features ?? [];
  } catch {
    const [lon, lat] = centroid(rings);
    const payload = await postQuery(path, pointBody(lon, lat, outFields), signal);
    return payload.features ?? [];
  }
}

export function centroid(rings: number[][][]): [number, number] {
  const points = rings.flat();
  if (!points.length) return [0, 0];
  const lon = points.reduce((sum, point) => sum + point[0], 0) / points.length;
  const lat = points.reduce((sum, point) => sum + point[1], 0) / points.length;
  return [lon, lat];
}

async function geocodeOnce(query: string, signal: AbortSignal): Promise<GeocodeHit | null> {
  const params = new URLSearchParams({
    format: "jsonv2",
    addressdetails: "1",
    limit: "1",
    countrycodes: "us",
    q: query,
  });
  const response = await fetch(serviceUrl(`/geo/search?${params.toString()}`), { signal });
  if (!response.ok) throw new Error(`Geocoder responded ${response.status}`);
  const rows = (await response.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
    address?: {
      county?: string;
      state?: string;
      city?: string;
      town?: string;
      village?: string;
      hamlet?: string;
      postcode?: string;
    };
  }>;
  const row = rows[0];
  if (!row) return null;
  const address = row.address ?? {};
  return {
    lat: Number(row.lat),
    lon: Number(row.lon),
    displayName: row.display_name,
    county: address.county,
    state: address.state,
    city: address.city || address.town || address.village || address.hamlet,
    postcode: address.postcode,
  };
}

export async function geocode(query: string): Promise<GeocodeHit | null> {
  const primary = await geocodeOnce(query, AbortSignal.timeout(8000));
  if (query.includes(",") || (primary && countyIsMiamiDade(primary.county))) return primary;
  const hint = miamiDadeGeocodeHint(query);
  if (!hint) return primary;
  try {
    const biased = await geocodeOnce(hint, AbortSignal.timeout(8000));
    if (biased && countyIsMiamiDade(biased.county)) return biased;
  } catch {
    /* Keep the first hit when the county-biased search does not answer. */
  }
  return primary;
}

export interface EnrichResult {
  facts: SiteFacts;
  choices?: ParcelFact[];
}

function blankFacts(input: {
  query: string;
  origin: SiteFacts["origin"];
  sampleId?: string;
  normalizedAddress: string | null;
}): SiteFacts {
  return {
    origin: input.origin,
    sampleId: input.sampleId,
    query: input.query,
    normalizedAddress: input.normalizedAddress,
    geocode: null,
    geocodeNote: null,
    scope: "unknown",
    parcel: null,
    parcelNote: null,
    municipality: null,
    unincorporated: null,
    zoning: null,
    zoningAreas: [],
    zoningNote: null,
    municipalZoning: null,
    insideUdb: null,
    cdmpDescriptions: [],
    primaryZoneDescription: null,
    addressRecord: null,
    addressDisagreement: null,
    zoneDisagreement: null,
    dataOrigin: "none",
    gisErrors: [],
    retrievedAt: new Date().toISOString(),
  };
}

export async function enrichParcel(facts: SiteFacts, parcel: ParcelFact, signal = AbortSignal.timeout(8000)): Promise<SiteFacts> {
  const next: SiteFacts = {
    ...facts,
    parcel,
    scope: "miami-dade",
    dataOrigin: "live",
    gisErrors: [],
    parcelNote: "Parcel, folio, and polygon area were read from the county parcel layer for this address.",
  };
  const jobs: Array<Promise<void>> = [];

  jobs.push(
    featuresAt(MUNI, parcel.rings, "NAME", signal)
      .then((features) => {
        const names = [...new Set(features.map((feature) => cleanText(String(feature.attributes.NAME ?? ""))).filter(Boolean))];
        if (names.length === 1) {
          next.municipality = names[0];
          next.unincorporated = isUnincorporatedName(names[0]);
        } else if (names.length > 1) {
          next.municipality = names.join("; ");
          next.unincorporated = null;
          next.gisErrors.push("More than one municipality polygon contains this parcel, so jurisdiction was left unverified.");
        }
      })
      .catch(() => {
        next.gisErrors.push("The municipality layer did not respond.");
      }),
  );

  jobs.push(
    featuresAt(ZONE, parcel.rings, "ZONE,ZONE_DESC,MUNC", signal)
      .then((features) => {
        const zones: ZoningFact[] = features
          .map((feature) => ({
            code: cleanText(String(feature.attributes.ZONE ?? "")),
            description: cleanText(String(feature.attributes.ZONE_DESC ?? "")),
            munc: cleanText(String(feature.attributes.MUNC ?? "")),
          }))
          .filter((zone) => zone.code && zone.code !== "NONE");
        const unique = [...new Map(zones.map((zone) => [zone.code, zone])).values()];
        next.zoningAreas = unique.map((zone) => zone.code);
        if (unique.length === 1) next.zoning = unique[0];
        else if (unique.length > 1) {
          next.zoning = null;
          next.zoningNote = `The parcel polygon intersects more than one zoning area (${next.zoningAreas.join(", ")}). None was selected as the district.`;
        }
      })
      .catch(() => {
        next.gisErrors.push("The unincorporated zone layer did not respond.");
      }),
  );

  jobs.push(
    featuresAt(CITY_ZONE, parcel.rings, "ZONE,MUNICNAME", signal)
      .then((features) => {
        const zones = features
          .map((feature) => ({
            code: cleanText(String(feature.attributes.ZONE ?? "")),
            description: cleanText(String(feature.attributes.MUNICNAME ?? "")),
          }))
          .filter((zone) => zone.code && zone.code !== "NONE");
        const unique = [...new Map(zones.map((zone) => [zone.code, zone])).values()];
        if (unique.length === 1) next.municipalZoning = unique[0];
      })
      .catch(() => {
        next.gisErrors.push("The municipal zoning layer did not respond.");
      }),
  );

  jobs.push(
    featuresAt(UDB, parcel.rings, "UDB", signal)
      .then((features) => {
        next.insideUdb = features.length > 0;
      })
      .catch(() => {
        next.gisErrors.push("The Urban Development Boundary layer did not respond.");
      }),
  );

  jobs.push(
    featuresAt(PRIMARY_ZONE, parcel.rings, "PZDESC", signal)
      .then((features) => {
        const descriptions = [
          ...new Set(features.map((feature) => cleanText(String(feature.attributes.PZDESC ?? ""))).filter(Boolean)),
        ];
        if (descriptions.length === 1) next.primaryZoneDescription = descriptions[0];
        else if (descriptions.length > 1) {
          next.gisErrors.push(
            `The primary-zone layer returned more than one description (${descriptions.join("; ")}). None was selected.`,
          );
        }
      })
      .catch(() => {
        next.gisErrors.push("The primary-zone layer did not respond.");
      }),
  );

  jobs.push(
    featuresAt(CDMP, parcel.rings, "DESCRIPTION", signal)
      .then((features) => {
        next.cdmpDescriptions = [
          ...new Set(features.map((feature) => cleanText(String(feature.attributes.DESCRIPTION ?? ""))).filter(Boolean)),
        ];
      })
      .catch(() => {
        next.gisErrors.push("The CDMP map layer did not respond.");
      }),
  );

  await Promise.all(jobs);
  noteAddressDisagreement(next);
  noteZoneDisagreement(next);
  next.retrievedAt = new Date().toISOString();
  return next;
}

function noteAddressDisagreement(facts: SiteFacts) {
  const record = facts.addressRecord;
  const parcel = facts.parcel;
  if (!record || !parcel) return;
  const standardized = normalizeStreet(record.address);
  const site = normalizeStreet(parcel.siteAddress);
  if (!standardized || !site || standardized === site) return;
  facts.addressDisagreement = `GeoProperty address “${record.address}” and parcel site address “${parcel.siteAddress}” do not match after address normalization. Both are shown as returned. Neither was rewritten.`;
}

function noteZoneDisagreement(facts: SiteFacts) {
  const geoZone = facts.addressRecord?.zone?.trim();
  const layerZone = facts.zoning?.code.trim();
  if (!geoZone || !layerZone || geoZone.toUpperCase() === layerZone.toUpperCase()) return;
  facts.zoneDisagreement = `GeoProperty Zone is ${geoZone}. The zone polygon layer returned ${layerZone}. The district was not scored.`;
}

function sqlText(value: string): string {
  return value.replaceAll("'", "''").replaceAll("%", "").replaceAll("_", "");
}

function dedupeParcels(parcels: ParcelFact[]): ParcelFact[] {
  const seen = new Set<string>();
  return parcels.filter((parcel) => {
    const key = `${parcel.folio}|${parcel.siteAddress}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function parcelsForText(normalized: string): Promise<ParcelFact[]> {
  const exact = await queryParcels(`TRUE_SITE_ADDR = '${sqlText(normalized)}'`);
  if (exact.length > 0) return dedupeParcels(exact);
  return dedupeParcels(await queryParcels(`TRUE_SITE_ADDR LIKE '${sqlText(normalized)}%'`));
}

async function parcelByFolio(folio: string): Promise<ParcelFact | null> {
  if (!/^\d{10,16}$/.test(folio)) return null;
  const rows = await queryParcels(`FOLIO = '${folio}'`);
  return rows[0] ?? null;
}

export type LookupResult =
  | { kind: "choose"; facts: SiteFacts; choices: ParcelFact[] }
  | { kind: "ready"; facts: SiteFacts }
  | { kind: "outside"; facts: SiteFacts }
  | {
      kind: "error";
      code: "unavailable" | "not-found" | "broad" | "county-unknown" | "unconfirmed";
      title: string;
      detail: string;
      facts: SiteFacts;
      fallback?: SiteFacts;
    };

function unavailable(facts: SiteFacts, detail: string, normalized: string | null): LookupResult {
  const blank = blankFacts({
    query: facts.query,
    origin: facts.origin,
    sampleId: facts.sampleId,
    normalizedAddress: normalized,
  });
  const fallback = normalized ? snapshotFacts(normalized, blank) : null;
  return {
    kind: "error",
    code: "unavailable",
    title: "Address lookup is unavailable",
    detail,
    facts,
    fallback: fallback ?? undefined,
  };
}

async function readyFromRecord(facts: SiteFacts, record: AddressRecord, parcelHint: ParcelFact | null): Promise<LookupResult> {
  facts.addressRecord = record;
  facts.scope = "miami-dade";
  facts.geocodeNote =
    "Street geocoding was not used to validate this address. Miami-Dade GeoProperty returned the record.";
  let parcel = parcelHint;
  if (!parcel || parcel.folio !== record.folio) {
    try {
      parcel = await parcelByFolio(record.folio);
    } catch {
      facts.gisErrors.push("The parcel layer did not return a polygon for this folio.");
      parcel = parcelHint && parcelHint.folio === record.folio ? parcelHint : null;
    }
  }
  if (parcelHint && parcel && parcelHint.folio !== record.folio) {
    facts.addressDisagreement = `The parcel row you chose is folio ${parcelHint.folio}. GeoProperty validated folio ${record.folio}. Both folios are shown. The screen did not pick one for scoring.`;
  }
  if (!parcel) {
    facts.dataOrigin = "live";
    facts.parcelNote = "GeoProperty returned a folio, and the parcel layer did not return a polygon for it.";
    facts.retrievedAt = new Date().toISOString();
    return { kind: "ready", facts };
  }
  if (facts.addressDisagreement && parcelHint && parcel.folio !== parcelHint.folio) {
    facts.dataOrigin = "live";
    facts.parcel = parcelHint;
    facts.retrievedAt = new Date().toISOString();
    return { kind: "ready", facts };
  }
  return { kind: "ready", facts: await enrichParcel(facts, parcel) };
}

export async function lookupAddress(input: {
  query: string;
  origin: SiteFacts["origin"];
  sampleId?: string;
  normalizedAddress: string | null;
}): Promise<LookupResult> {
  const facts = blankFacts(input);
  const normalized = input.normalizedAddress;
  let record: AddressRecord | null = null;
  try {
    record = await fetchGeoProperty(input.query);
  } catch (error: unknown) {
    const detail = error instanceof AddressServiceError ? error.message : "Miami-Dade GeoProperty did not respond.";
    return unavailable(facts, detail, normalized);
  }
  if (record) return readyFromRecord(facts, record, null);

  facts.geocodeNote = "Miami-Dade GeoProperty returned no folio for this text.";
  try {
    facts.geocode = await geocode(input.query);
  } catch (error: unknown) {
    const name = error instanceof Error ? error.name : "";
    facts.geocodeNote =
      name === "TimeoutError" || name === "AbortError"
        ? "Miami-Dade GeoProperty found nothing, and the street geocoder did not answer within 8 seconds."
        : "Miami-Dade GeoProperty found nothing, and the street geocoder did not respond.";
  }

  const hit = facts.geocode;
  const namedCounty = Boolean(hit?.county);
  const inCounty = hit ? countyIsMiamiDade(hit.county) : false;
  if (hit && namedCounty && !inCounty) {
    facts.scope = "outside";
    return { kind: "outside", facts };
  }
  if (!normalized) {
    if (hit && inCounty) {
      return {
        kind: "error",
        code: "broad",
        title: "Enter a house number and street",
        detail: `The geocoder found “${hit.displayName}”, which is too broad to match a parcel. GeoProperty returned no folio.`,
        facts,
      };
    }
    if (hit && !namedCounty) {
      return {
        kind: "error",
        code: "county-unknown",
        title: "County could not be confirmed",
        detail: `The geocoder returned “${hit.displayName}” without a county, and GeoProperty returned no folio.`,
        facts,
      };
    }
    return {
      kind: "error",
      code: "not-found",
      title: "No address match",
      detail: "Miami-Dade GeoProperty returned no folio for this text.",
      facts,
    };
  }

  let parcels: ParcelFact[] = [];
  try {
    parcels = await parcelsForText(normalized);
  } catch (error: unknown) {
    const name = error instanceof Error ? error.name : "";
    const detail =
      name === "TimeoutError" || name === "AbortError"
        ? "Miami-Dade GeoProperty found nothing, and the parcel layer did not answer within 8 seconds."
        : "Miami-Dade GeoProperty found nothing, and the parcel layer did not respond.";
    return unavailable(facts, detail, normalized);
  }
  if (parcels.length > 1) {
    facts.parcelNote =
      parcels.length >= 8
        ? "GeoProperty did not standardize this text. The parcel layer returned 8 site addresses, the most this screen requests. Choose one and GeoProperty will be asked to validate that site address."
        : "GeoProperty did not standardize this text. The parcel layer returned more than one site address. Choose one and GeoProperty will be asked to validate it. Nothing is scored until that validation succeeds.";
    return { kind: "choose", facts, choices: parcels };
  }
  if (parcels.length === 1) {
    try {
      const confirmed = await fetchGeoProperty(parcels[0].siteAddress);
      if (!confirmed) {
        return {
          kind: "error",
          code: "unconfirmed",
          title: "Address was not validated",
          detail: `The parcel layer listed ${parcels[0].siteAddress}, and GeoProperty did not validate it. It was not used.`,
          facts,
        };
      }
      return readyFromRecord(facts, confirmed, parcels[0]);
    } catch (error: unknown) {
      const detail = error instanceof AddressServiceError ? error.message : "Miami-Dade GeoProperty did not respond.";
      return unavailable(facts, detail, normalized);
    }
  }
  return {
    kind: "error",
    code: "not-found",
    title: "No address match",
    detail: "Miami-Dade GeoProperty returned no folio, and the parcel layer returned no site address.",
    facts,
  };
}

export async function confirmParcel(facts: SiteFacts, parcel: ParcelFact): Promise<LookupResult> {
  try {
    const record = await fetchGeoProperty(parcel.siteAddress);
    if (!record) {
      return {
        kind: "error",
        code: "unconfirmed",
        title: "Address was not validated",
        detail: `GeoProperty did not validate ${parcel.siteAddress}. It was not scored.`,
        facts,
      };
    }
    const next: SiteFacts = { ...facts, gisErrors: [], addressDisagreement: null, zoneDisagreement: null };
    return readyFromRecord(next, record, parcel);
  } catch (error: unknown) {
    const detail = error instanceof AddressServiceError ? error.message : "Miami-Dade GeoProperty did not respond.";
    return unavailable(facts, detail, facts.normalizedAddress);
  }
}

export async function lookupFolio(folio: string): Promise<LookupResult> {
  const digits = folio.replace(/\D/g, "");
  const facts = blankFacts({ query: digits, origin: "search", normalizedAddress: null });
  if (!/^\d{13}$/.test(digits)) {
    return {
      kind: "error",
      code: "not-found",
      title: "No address match",
      detail: "A folio lookup needs the 13-digit folio returned by the county.",
      facts,
    };
  }
  try {
    const parcel = await parcelByFolio(digits);
    if (!parcel) {
      return {
        kind: "error",
        code: "not-found",
        title: "No address match",
        detail: "The parcel layer returned no polygon for this folio.",
        facts,
      };
    }
    return confirmParcel(facts, parcel);
  } catch (error: unknown) {
    const detail = error instanceof AddressServiceError ? error.message : "The parcel layer did not respond.";
    return unavailable(facts, detail, null);
  }
}
