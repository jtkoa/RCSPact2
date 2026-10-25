export function cleanText(value: string): string {
  return value.replace(/\u00ff/g, " ").replace(/\s+/g, " ").trim();
}

export function extentEstimate(rings: number[][][]): { eastWestFt: number; northSouthFt: number } | null {
  const points = rings.flat();
  if (points.length < 3) return null;
  const lons = points.map((point) => point[0]);
  const lats = points.map((point) => point[1]);
  const midLat = lats.reduce((sum, value) => sum + value, 0) / lats.length;
  const eastWestFt = (Math.max(...lons) - Math.min(...lons)) * 111320 * Math.cos((midLat * Math.PI) / 180) * 3.28084;
  const northSouthFt = (Math.max(...lats) - Math.min(...lats)) * 110540 * 3.28084;
  if (!Number.isFinite(eastWestFt) || !Number.isFinite(northSouthFt) || eastWestFt < 1 || northSouthFt < 1) return null;
  return { eastWestFt: Math.round(eastWestFt), northSouthFt: Math.round(northSouthFt) };
}

export function formatSqFt(value: number): string {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)} sq ft`;
}

export function formatFolio(folio: string): string {
  const digits = folio.replace(/\D/g, "");
  if (digits.length !== 13) return folio;
  return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/New_York",
  }).format(date);
}

export function zoneFamily(code: string): "AU" | "EU" | "RU" | "GU" | "OTHER" {
  const normalized = code.trim().toUpperCase();
  const match = /^(AU|EU|RU|GU)(?:-|$|\d)/.exec(normalized);
  if (!match) return "OTHER";
  return match[1] as "AU" | "EU" | "RU" | "GU";
}

export function isUnincorporatedName(name: string): boolean {
  return name.toUpperCase().includes("UNINCORPORATED");
}
