import type { AddressRecord } from "../engine/types";
import { serviceUrl } from "./serviceUrl";

const ENDPOINT = "/gis/address/GeoProperty.asmx/GeoProperty";
const NS = "http://intra.miamidade.gov/GISAddress";

export class AddressServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AddressServiceError";
  }
}

function tagText(parent: Element, tag: string): string {
  const nodes = parent.getElementsByTagNameNS(NS, tag);
  const fromNs = nodes.item(0)?.textContent ?? "";
  if (fromNs.trim()) return fromNs.trim();
  const plain = parent.getElementsByTagName(tag).item(0)?.textContent ?? "";
  return plain.trim();
}

function integerOrNull(value: string): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function xmlTag(xml: string, tag: string): string {
  const match = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "i").exec(xml);
  return (match?.[1] ?? "").replace(/<!\[CDATA\[|\]\]>/g, "").trim();
}

export function parseGeoPropertyXml(xml: string, retrievedAt: string): AddressRecord | null {
  const read = (tag: string) => {
    if (typeof DOMParser === "undefined") return xmlTag(xml, tag);
    const document = new DOMParser().parseFromString(xml, "text/xml");
    if (document.querySelector("parsererror")) {
      throw new AddressServiceError("Miami-Dade GeoProperty returned a response that could not be read.");
    }
    const root = document.documentElement;
    if (!root) throw new AddressServiceError("Miami-Dade GeoProperty returned an empty response.");
    return tagText(root, tag);
  };
  const folio = read("Folio");
  const hNum = integerOrNull(read("H_Num")) ?? 0;
  if (!folio || hNum === 0) return null;
  return {
    sourceName: "Miami-Dade GeoProperty",
    operation: "GeoProperty",
    retrievedAt,
    folio,
    address: read("Address"),
    hNum,
    preDir: read("Pre_Dir"),
    stName: read("St_Name"),
    stType: read("St_Type"),
    stType2: read("St_Type2"),
    sufDir: read("Suf_Dir"),
    subunit: read("Subunit"),
    zip: integerOrNull(read("Zip")),
    condoFlg: read("CondoFlg"),
    cluc: read("Cluc"),
    ttrrss: read("TTRRSS"),
    cd: integerOrNull(read("CD")),
    pre: integerOrNull(read("Pre")),
    trt2000: read("Trt2000"),
    grid: read("Grid"),
    taz: integerOrNull(read("Taz")),
    council: integerOrNull(read("Council")),
    subArea: read("SubArea"),
    zone: read("Zone"),
    floodZone: read("Flood_Zone"),
    floodElev: read("Flood_Elev"),
    x: integerOrNull(read("X_Coord")),
    y: integerOrNull(read("Y_Coord")),
  };
}

export function splitTrailingZip(query: string): { address: string; zip: string } {
  const trimmed = query.trim();
  const match = /^(.*?)(?:\s+|,\s*)(\d{5})(?:-\d{4})?\s*$/.exec(trimmed);
  if (!match || !match[1].trim()) return { address: trimmed, zip: "" };
  return { address: match[1].trim().replace(/[,\s]+$/g, ""), zip: match[2] };
}

async function requestGeoProperty(address: string, zip: string): Promise<AddressRecord | null> {
  const params = new URLSearchParams({ myAddress: address, myZipCode: zip });
  let response: Response;
  try {
    response = await fetch(serviceUrl(`${ENDPOINT}?${params.toString()}`), { signal: AbortSignal.timeout(12000) });
  } catch (error: unknown) {
    const name = error instanceof Error ? error.name : "";
    if (name === "TimeoutError" || name === "AbortError") {
      throw new AddressServiceError("Miami-Dade GeoProperty did not answer within 12 seconds.");
    }
    throw new AddressServiceError("Miami-Dade GeoProperty did not respond.");
  }
  if (!response.ok) {
    throw new AddressServiceError(`Miami-Dade GeoProperty responded ${response.status}.`);
  }
  const xml = await response.text();
  if (!xml.includes("ArrLprop") && !xml.includes("Folio")) {
    throw new AddressServiceError("Miami-Dade GeoProperty did not return an address record.");
  }
  return parseGeoPropertyXml(xml, new Date().toISOString());
}

export async function fetchGeoProperty(query: string): Promise<AddressRecord | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;
  const split = splitTrailingZip(trimmed);
  const primary = await requestGeoProperty(split.address, split.zip);
  if (primary || split.address === trimmed) return primary;
  return requestGeoProperty(trimmed, "");
}

export function geoFieldLines(record: AddressRecord): string[] {
  const lines: string[] = [];
  const add = (name: string, value: string | number | null | undefined) => {
    if (value == null) return;
    const text = String(value).trim();
    if (!text) return;
    lines.push(`${name}: ${text}`);
  };
  add("Address", record.address);
  add("Folio", record.folio);
  add("H_Num", record.hNum);
  add("Pre_Dir", record.preDir);
  add("St_Name", record.stName);
  add("St_Type", record.stType);
  add("St_Type2", record.stType2);
  add("Suf_Dir", record.sufDir);
  add("Subunit", record.subunit);
  add("Zip", record.zip);
  add("CondoFlg", record.condoFlg);
  add("Cluc", record.cluc);
  add("TTRRSS", record.ttrrss);
  add("CD", record.cd);
  add("Pre", record.pre);
  add("Trt2000", record.trt2000);
  add("Grid", record.grid);
  add("Taz", record.taz);
  add("Council", record.council);
  add("SubArea", record.subArea);
  add("Zone", record.zone);
  add("Flood_Zone", record.floodZone);
  if (record.floodElev === "-9999") {
    lines.push("Flood_Elev: -9999. The service returned this sentinel instead of an elevation.");
  } else {
    add("Flood_Elev", record.floodElev);
  }
  if (record.x != null && record.y != null) {
    lines.push(`X_Coord: ${record.x}. Y_Coord: ${record.y}. State-plane feet as returned, not longitude and latitude.`);
  }
  return lines;
}
