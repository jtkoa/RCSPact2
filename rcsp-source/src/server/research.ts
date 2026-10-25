import {
  type CaseEvidence,
  type CodeEvidence,
  type LotFieldEvidence,
  type OverlayEvidence,
  type PermitEvidence,
  type ResearchState,
  type ResearchStep,
  type SketchEvidence,
  researchKey,
} from "../engine/researchTypes";

const USER_AGENT = "RCSP-Preliminary-Screening/0.1";

const PERMIT_URL = "https://gis.miamidade.gov/arcgis/rest/services/MD_LandInformation/MapServer/1";
const LOT_URL = "https://gis.miamidade.gov/arcgis/rest/services/MD_LandInformation/MapServer/27";
const ZONE_URL = "https://gis.miamidade.gov/arcgis/rest/services/MD_MDCZoning/MapServer/6";
const WELL_URL = "https://gis.miamidade.gov/arcgis/rest/services/MD_EnvironmentalConsiderations/MapServer/4";
const WET_URL = "https://gis.miamidade.gov/arcgis/rest/services/MD_EnvironmentalConsiderations/MapServer/5";
const URBAN_URL = "https://gis.miamidade.gov/arcgis/rest/services/MD_MDCZoning/MapServer/4";
const TRANSIT_URL = "https://gis.miamidade.gov/arcgis/rest/services/LandManagement/MD_Zoning/MapServer/3";
const LAND_USE_URL = "https://gis.miamidade.gov/arcgis/rest/services/LandManagement/MD_LandUse/MapServer/0";
const HEARING_URL = "https://gis.miamidade.gov/arcgis/rest/services/LandManagement/MD_ZoningRecords/MapServer/0";
const PLAT_URL = "https://gis.miamidade.gov/arcgis/rest/services/LandManagement/MD_PlattingRecords/MapServer/0";
const PARCEL_URL = "https://gis.miamidade.gov/arcgis/rest/services/LandManagement/MD_ZoningLandManagementData/MapServer/3";
const ZONE_TABLE_URL = "https://gisfs.miamidade.gov/mdarcgis/rest/services/MD_PA_PropertySearch/MapServer/20";
const MUNICIDE = "https://library.municode.com/fl/miami_-_dade_county/codes/code_of_ordinances?nodeId=PTIIICOOR_CH33ZO_ARTIINGE_S33-22ACUN";
const SECTION_28 = "https://library.municode.com/fl/miami_-_dade_county/codes/code_of_ordinances?nodeId=PTIIICOOR_CH33ZO_ARTIINGE_S33-28VARE";
const ADU_PAGE = "https://www.miamidade.gov/global/economy/building/accessory-dwelling-unit-adu.page";
const STATUTE = "https://www.flsenate.gov/Laws/Statutes/2026/163.31771";

const inflight = new Map<string, Promise<ResearchState[keyof ResearchState]>>();
const completed = new Map<string, ResearchState[keyof ResearchState]>();

export function folioDigits(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  return digits.length === 13 ? digits : null;
}

function sketchUrl(folio: string): string {
  return `https://apps.miamidadepa.gov/PAOnlineTools/PropertySketch/Sketch.aspx?Folio=${folio}&year=2026`;
}

async function gis(url: string, params: Record<string, string>): Promise<{ status: number; count: number; features: Array<{ attributes: Record<string, unknown>; geometry?: { rings?: number[][][] } }> }> {
  const response = await fetch(`${url}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": USER_AGENT },
    body: new URLSearchParams({ f: "json", ...params }),
    signal: AbortSignal.timeout(20000),
  });
  const status = response.status;
  if (!response.ok) {
    throw Object.assign(new Error("http"), { httpStatus: status });
  }
  const payload = (await response.json()) as {
    error?: { message?: string };
    count?: number;
    features?: Array<{ attributes: Record<string, unknown>; geometry?: { rings?: number[][][] } }>;
  };
  if (payload.error) {
    throw Object.assign(new Error("http"), { httpStatus: status });
  }
  const features = payload.features ?? [];
  return { status, count: typeof payload.count === "number" ? payload.count : features.length, features };
}

async function layerMeta(url: string): Promise<{ status: number; fields: string[] }> {
  const response = await fetch(`${url}?f=json`, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw Object.assign(new Error("http"), { httpStatus: response.status });
  const payload = (await response.json()) as { fields?: Array<{ name: string }>; error?: unknown };
  if (payload.error) throw Object.assign(new Error("http"), { httpStatus: response.status });
  return { status: response.status, fields: (payload.fields ?? []).map((field) => field.name) };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function plainHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchPage(url: string): Promise<{ status: number | null; text: string }> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "GET",
        redirect: "follow",
        headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/pdf,*/*" },
        signal: AbortSignal.timeout(15000),
      });
      const text = response.ok ? await response.text() : "";
      if (response.status >= 500 && attempt === 0) {
        await wait(500);
        continue;
      }
      return { status: response.status, text };
    } catch {
      if (attempt === 0) {
        await wait(500);
        continue;
      }
      return { status: null, text: "" };
    }
  }
  return { status: null, text: "" };
}

async function statusOnly(url: string): Promise<number | null> {
  const page = await fetchPage(url);
  return page.status;
}

function span(html: string, id: string): string | null {
  const match = new RegExp(`id="${id}"[^>]*>([^<]*)<`, "i").exec(html);
  return match ? match[1].replace(/\s+/g, " ").trim() : null;
}

function sqft(value: string | null): number | null {
  if (!value) return null;
  const match = value.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const number = Number(match[1]);
  return Number.isFinite(number) && number > 0 ? number : null;
}

async function parcel(folio: string): Promise<{ address: string; lon: number; lat: number } | null> {
  const payload = await gis(PARCEL_URL, {
    where: `FOLIO='${folio}'`,
    outFields: "FOLIO,TRUE_SITE_ADDR",
    returnGeometry: "true",
    outSR: "4326",
  });
  const feature = payload.features[0] as { attributes: Record<string, unknown>; geometry?: { rings?: number[][][] } } | undefined;
  const rings = feature?.geometry?.rings ?? [];
  const points = rings.flat();
  if (!feature || points.length === 0) return null;
  const lon = points.reduce((sum, point) => sum + point[0], 0) / points.length;
  const lat = points.reduce((sum, point) => sum + point[1], 0) / points.length;
  return { address: String(feature.attributes.TRUE_SITE_ADDR ?? "").trim(), lon, lat };
}

async function sketchStep(folio: string): Promise<SketchEvidence> {
  const url = sketchUrl(folio);
  const retrievedAt = new Date().toISOString();
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      return { ok: false, httpStatus: response.status, url, retrievedAt, address: null, actualSqFt: null, livingSqFt: null, adjustedSqFt: null, matchedFolio: false, error: "http" };
    }
    const html = await response.text();
    const shown = span(html, "ctl00_ContentPlaceHolder1_lblFolioValue");
    const matched = (shown ?? "").replace(/\D/g, "") === folio;
    if (!matched) {
      return { ok: false, httpStatus: response.status, url, retrievedAt, address: null, actualSqFt: null, livingSqFt: null, adjustedSqFt: null, matchedFolio: false, error: "mismatch" };
    }
    return {
      ok: true,
      httpStatus: response.status,
      url,
      retrievedAt,
      address: span(html, "ctl00_ContentPlaceHolder1_lblPropertyAddressValue"),
      actualSqFt: sqft(span(html, "ctl00_ContentPlaceHolder1_lblActualAreaValue")),
      livingSqFt: sqft(span(html, "ctl00_ContentPlaceHolder1_lblLivingAreaValue")),
      adjustedSqFt: sqft(span(html, "ctl00_ContentPlaceHolder1_lblAdjustedAreaValue")),
      matchedFolio: true,
      error: null,
    };
  } catch {
    return { ok: false, httpStatus: null, url, retrievedAt, address: null, actualSqFt: null, livingSqFt: null, adjustedSqFt: null, matchedFolio: false, error: "timeout" };
  }
}

async function permitStep(folio: string): Promise<PermitEvidence> {
  const retrievedAt = new Date().toISOString();
  try {
    const place = await parcel(folio);
    const byFolio = await gis(PERMIT_URL, {
      where: `FOLIO='${folio}'`,
      outFields: "FOLIO",
      returnGeometry: "false",
      returnCountOnly: "true",
    });
    const address = place?.address?.replace(/'/g, "''") ?? "";
    const byAddress = address
      ? await gis(PERMIT_URL, {
          where: `ADDRESS LIKE '${address}%'`,
          outFields: "FOLIO",
          returnGeometry: "false",
          returnCountOnly: "true",
        })
      : { status: 200, count: 0, features: [] };
    const byPoint = place
      ? await gis(PERMIT_URL, {
          geometry: `${place.lon},${place.lat}`,
          geometryType: "esriGeometryPoint",
          inSR: "4326",
          spatialRel: "esriSpatialRelIntersects",
          outFields: "FOLIO",
          returnGeometry: "false",
          returnCountOnly: "true",
        })
      : { status: 200, count: 0, features: [] };
    return {
      ok: true,
      httpStatus: byFolio.status,
      url: PERMIT_URL,
      retrievedAt,
      folioMatches: byFolio.count,
      addressMatches: byAddress.count,
      pointMatches: byPoint.count,
      error: null,
    };
  } catch (error) {
    const httpStatus = typeof error === "object" && error && "httpStatus" in error ? Number(error.httpStatus) : null;
    return { ok: false, httpStatus, url: PERMIT_URL, retrievedAt, folioMatches: null, addressMatches: null, pointMatches: null, error: httpStatus ? "http" : "timeout" };
  }
}

async function countAt(url: string, lon: number, lat: number, outFields: string): Promise<number> {
  const payload = await gis(url, {
    geometry: `${lon},${lat}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields,
    returnGeometry: "false",
  });
  return payload.features.length;
}

async function overlayStep(folio: string): Promise<OverlayEvidence> {
  const retrievedAt = new Date().toISOString();
  const urls = [
    { title: "Unincorporated zoning map", url: ZONE_URL },
    { title: "Wellfield protection areas", url: WELL_URL },
    { title: "Wetland areas of concern", url: WET_URL },
    { title: "Urban centers", url: URBAN_URL },
    { title: "Rapid transit zones", url: TRANSIT_URL },
    { title: "Existing land use", url: LAND_USE_URL },
  ];
  const failed: string[] = [];
  const place = await parcel(folio).catch(() => null);
  if (!place) {
    return {
      ok: false,
      retrievedAt,
      zoneOverlay: null,
      zoneDescription: null,
      wellfieldName: null,
      wetlandCount: null,
      urbanCenterCount: null,
      rapidTransitCount: null,
      landUse: null,
      failedLayers: ["parcel"],
      urls,
    };
  }
  async function safe<T>(name: string, run: () => Promise<T>, empty: T): Promise<T> {
    try {
      return await run();
    } catch {
      failed.push(name);
      return empty;
    }
  }
  const zone = await safe("zoning", async () => {
    const payload = await gis(ZONE_URL, {
      geometry: `${place.lon},${place.lat}`,
      geometryType: "esriGeometryPoint",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: "ZONE,ZONE_DESC,OVLY",
      returnGeometry: "false",
    });
    return payload.features[0]?.attributes ?? null;
  }, null);
  const well = await safe("wellfield", async () => {
    const payload = await gis(WELL_URL, {
      geometry: `${place.lon},${place.lat}`,
      geometryType: "esriGeometryPoint",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: "NAME,WELLCODE",
      returnGeometry: "false",
    });
    return payload.features[0]?.attributes ?? null;
  }, null);
  const wetlandCount = await safe("wetland", () => countAt(WET_URL, place.lon, place.lat, "OBJECTID"), null);
  const urbanCenterCount = await safe("urban-center", () => countAt(URBAN_URL, place.lon, place.lat, "OBJECTID"), null);
  const rapidTransitCount = await safe("rapid-transit", () => countAt(TRANSIT_URL, place.lon, place.lat, "OBJECTID"), null);
  const land = await safe("land-use", async () => {
    const payload = await gis(LAND_USE_URL, {
      geometry: `${place.lon},${place.lat}`,
      geometryType: "esriGeometryPoint",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: "LU,DESCR",
      returnGeometry: "false",
    });
    return payload.features[0]?.attributes ?? null;
  }, null);
  const overlay = zone ? String(zone.OVLY ?? "").trim() : null;
  return {
    ok: failed.length === 0,
    retrievedAt,
    zoneOverlay: overlay,
    zoneDescription: zone ? String(zone.ZONE_DESC ?? "").replace(/\u00ff/g, " ").replace(/\s+/g, " ").trim() : null,
    wellfieldName: well ? String(well.NAME ?? "").trim() || null : null,
    wetlandCount,
    urbanCenterCount,
    rapidTransitCount,
    landUse: land ? String(land.DESCR ?? "").trim() || null : null,
    failedLayers: failed,
    urls,
  };
}

async function caseStep(folio: string): Promise<CaseEvidence> {
  const retrievedAt = new Date().toISOString();
  try {
    const hearings = await gis(HEARING_URL, { where: `FOLIO='${folio}'`, outFields: "FOLIO", returnGeometry: "false", returnCountOnly: "true" });
    const plats = await gis(PLAT_URL, { where: `FOLIO='${folio}'`, outFields: "FOLIO", returnGeometry: "false", returnCountOnly: "true" });
    return { ok: true, httpStatus: hearings.status, retrievedAt, hearings: hearings.count, plats: plats.count, hearingUrl: HEARING_URL, platUrl: PLAT_URL, error: null };
  } catch (error) {
    const httpStatus = typeof error === "object" && error && "httpStatus" in error ? Number(error.httpStatus) : null;
    return { ok: false, httpStatus, retrievedAt, hearings: null, plats: null, hearingUrl: HEARING_URL, platUrl: PLAT_URL, error: httpStatus ? "http" : "timeout" };
  }
}

async function codeStep(folio: string): Promise<CodeEvidence> {
  const retrievedAt = new Date().toISOString();
  const place = await parcel(folio).catch(() => null);
  let zoneTableDescription: string | null = null;
  let zoneTableFields: string[] = [];
  let zoneTableStatus: number | null = null;
  try {
    const meta = await layerMeta(ZONE_TABLE_URL);
    zoneTableStatus = meta.status;
    zoneTableFields = meta.fields;
    if (place) {
      const zoneHit = await gis(ZONE_URL, {
        geometry: `${place.lon},${place.lat}`,
        geometryType: "esriGeometryPoint",
        inSR: "4326",
        spatialRel: "esriSpatialRelIntersects",
        outFields: "ZONE",
        returnGeometry: "false",
      });
      const zone = String(zoneHit.features[0]?.attributes.ZONE ?? "").replace(/'/g, "");
      if (zone) {
        const row = await gis(ZONE_TABLE_URL, { where: `ZONE='${zone}'`, outFields: "*", returnGeometry: "false" });
        zoneTableDescription = row.features[0] ? String(row.features[0].attributes.ZONE_DESC ?? "").replace(/\u00ff/g, " ").trim() : null;
      }
    }
  } catch (error) {
    zoneTableStatus = typeof error === "object" && error && "httpStatus" in error ? Number(error.httpStatus) : null;
  }
  const [municodePage, section28Status, aduPage, statutePage] = await Promise.all([
    fetchPage(MUNICIDE),
    statusOnly(SECTION_28),
    fetchPage(ADU_PAGE),
    fetchPage(STATUTE),
  ]);
  const aduText = plainHtml(aduPage.text);
  const statuteText = plainHtml(statutePage.text);
  const lotMinPublished = /7,500\s+square feet/i.test(aduText);
  const ruSizePublished = /400\s*-\s*800/i.test(aduText) && /RU-1/i.test(aduText);
  const setbackMentioned = /setback requirements still apply/i.test(aduText);
  const heightMentioned = /height of the structure cannot exceed/i.test(aduText);
  const statuteAffidavit = /affidavit/i.test(statuteText) && /accessory dwelling unit/i.test(statuteText);
  const eligibilityDistrictsPublished = /zoning districts located inside of the Urban Development Boundary:\s*AU,\s*EU,\s*and\s*RU/i.test(aduText);
  const occupancyLimitPublished = /maximum of two persons per bedroom/i.test(aduText);
  const parkingRulePublished = /one additional parking space/i.test(aduText) && /within the same property/i.test(aduText);
  const separateSalePublished = /cannot be sold independently/i.test(aduText);
  const frontPlacementProhibited = /detached units may not be in front/i.test(aduText);
  const hoaNoticePublished = /Community Association/i.test(aduText) && /proof of notification/i.test(aduText);
  const permitRequiredPublished = /building permit is required/i.test(aduText);
  const municodeBlocked = municodePage.status === 403 || municodePage.status === 401 || municodePage.status == null;
  const recoverySource = municodeBlocked && aduPage.status === 200 && (lotMinPublished || /33-22/i.test(aduText)) ? "county-adu-page" : "";
  console.info(`rcsp-research code municode=${municodePage.status ?? "none"} recovery=${recoverySource || "none"} adu=${aduPage.status ?? "none"}`);
  return {
    retrievedAt,
    municodeStatus: municodePage.status,
    section28Status,
    aduPageStatus: aduPage.status,
    statuteStatus: statutePage.status,
    zoneTableDescription,
    zoneTableFields,
    zoneTableStatus,
    municodeUrl: MUNICIDE,
    section28Url: SECTION_28,
    aduUrl: ADU_PAGE,
    statuteUrl: STATUTE,
    zoneTableUrl: ZONE_TABLE_URL,
    lotMinPublished,
    ruSizePublished,
    setbackMentioned,
    heightMentioned,
    statuteAffidavit,
    eligibilityDistrictsPublished,
    occupancyLimitPublished,
    parkingRulePublished,
    separateSalePublished,
    frontPlacementProhibited,
    hoaNoticePublished,
    permitRequiredPublished,
    recoverySource,
    recoveryUrl: recoverySource ? ADU_PAGE : "",
  };
}

async function lotStep(): Promise<LotFieldEvidence> {
  const retrievedAt = new Date().toISOString();
  try {
    const meta = await layerMeta(LOT_URL);
    const hasWidthOrDepth = meta.fields.some((name) => /width|depth|frontage/i.test(name));
    return { ok: true, httpStatus: meta.status, url: LOT_URL, retrievedAt, fieldNames: meta.fields, hasWidthOrDepth, error: null };
  } catch (error) {
    const httpStatus = typeof error === "object" && error && "httpStatus" in error ? Number(error.httpStatus) : null;
    return { ok: false, httpStatus, url: LOT_URL, retrievedAt, fieldNames: [], hasWidthOrDepth: false, error: httpStatus ? "http" : "timeout" };
  }
}

async function run(step: ResearchStep, folio: string): Promise<ResearchState[keyof ResearchState]> {
  if (step === "sketch") return sketchStep(folio);
  if (step === "permits") return permitStep(folio);
  if (step === "overlays") return overlayStep(folio);
  if (step === "cases") return caseStep(folio);
  if (step === "code") return codeStep(folio);
  return lotStep();
}

export async function runResearchStep(step: ResearchStep, folio: string): Promise<ResearchState[keyof ResearchState]> {
  const key = `${folio}:${step}`;
  const done = completed.get(key);
  if (done) return done;
  const existing = inflight.get(key);
  if (existing) return existing;
  const pending = run(step, folio)
    .then((result) => {
      completed.set(key, result);
      return result;
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, pending);
  return pending;
}

export { researchKey };
