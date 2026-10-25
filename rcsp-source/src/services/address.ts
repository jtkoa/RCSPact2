const DIRECTIONS: Record<string, string> = {
  NORTH: "N",
  SOUTH: "S",
  EAST: "E",
  WEST: "W",
  NORTHEAST: "NE",
  NORTHWEST: "NW",
  SOUTHEAST: "SE",
  SOUTHWEST: "SW",
  N: "N",
  S: "S",
  E: "E",
  W: "W",
  NE: "NE",
  NW: "NW",
  SE: "SE",
  SW: "SW",
};

const SUFFIXES: Record<string, string> = {
  AVENUE: "AVE",
  AVE: "AVE",
  STREET: "ST",
  ST: "ST",
  ROAD: "RD",
  RD: "RD",
  DRIVE: "DR",
  DR: "DR",
  COURT: "CT",
  CT: "CT",
  LANE: "LN",
  LN: "LN",
  PLACE: "PL",
  PL: "PL",
  TERRACE: "TER",
  TER: "TER",
  TERR: "TER",
  BOULEVARD: "BLVD",
  BLVD: "BLVD",
  CIRCLE: "CIR",
  CIR: "CIR",
  WAY: "WAY",
  PARKWAY: "PKWY",
  PKWY: "PKWY",
  HIGHWAY: "HWY",
  HWY: "HWY",
  TRAIL: "TRL",
  TRL: "TRL",
};

const UNIT_WORDS = new Set(["APT", "APARTMENT", "UNIT", "STE", "SUITE", "FL", "FLOOR", "#"]);

function stripOrdinal(token: string): string {
  return token.replace(/^(\d+)(ST|ND|RD|TH)$/, "$1");
}

export function normalizeStreet(input: string): string | null {
  const upper = input.toUpperCase().replace(/[#.]/g, " ").replace(/\s+/g, " ").trim();
  if (!upper) return null;
  const streetPart = upper.split(",")[0]?.trim() ?? "";
  let street = streetPart;
  if (!input.includes(",")) {
    street = street.replace(/\s+\d{5}(?:-\d{4})?$/g, " ");
    street = street.replace(/\b(FLORIDA|USA|UNITED STATES)\b/g, " ");
    street = street.replace(/\bMIAMI[-\s]?DADE(?:\s+COUNTY)?\b/g, " ");
    street = street.replace(/\bCOUNTY\b/g, " ");
    street = street.replace(/\bFL\b/g, " ");
    street = street.replace(/\bMIAMI\s*$/g, " ");
  }
  const rawTokens = street
    .replace(/[^A-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const tokens: string[] = [];
  for (let index = 0; index < rawTokens.length; index += 1) {
    const token = stripOrdinal(rawTokens[index]);
    if (UNIT_WORDS.has(token)) {
      index += 1;
      continue;
    }
    if (DIRECTIONS[token]) {
      tokens.push(DIRECTIONS[token]);
      continue;
    }
    if (SUFFIXES[token]) {
      tokens.push(SUFFIXES[token]);
      continue;
    }
    tokens.push(token);
  }
  const normalized = tokens.join(" ").trim();
  if (!/^\d+\s+[A-Z0-9 ]+$/.test(normalized)) return null;
  return normalized;
}

const LONG_DIRECTION: Record<string, string> = {
  N: "North",
  S: "South",
  E: "East",
  W: "West",
  NE: "Northeast",
  NW: "Northwest",
  SE: "Southeast",
  SW: "Southwest",
};

const LONG_SUFFIX: Record<string, string> = {
  AVE: "Avenue",
  ST: "Street",
  RD: "Road",
  DR: "Drive",
  CT: "Court",
  LN: "Lane",
  PL: "Place",
  TER: "Terrace",
  BLVD: "Boulevard",
  CIR: "Circle",
  WAY: "Way",
  PKWY: "Parkway",
  HWY: "Highway",
  TRL: "Trail",
};

function ordinal(value: string): string {
  const number = Number(value);
  const tail = number % 100;
  if (tail >= 11 && tail <= 13) return `${value}th`;
  if (number % 10 === 1) return `${value}st`;
  if (number % 10 === 2) return `${value}nd`;
  if (number % 10 === 3) return `${value}rd`;
  return `${value}th`;
}

export function miamiDadeGeocodeHint(query: string): string | null {
  const normalized = normalizeStreet(query);
  if (!normalized) return null;
  const match = /^(\d+)\s+(NE|NW|SE|SW|N|S|E|W)\s+(\d+)\s+([A-Z]+)$/.exec(normalized);
  if (!match) return null;
  const direction = LONG_DIRECTION[match[2]] ?? match[2];
  const suffix = LONG_SUFFIX[match[4]] ?? match[4];
  return `${match[1]} ${direction} ${ordinal(match[3])} ${suffix}, Miami-Dade County, Florida`;
}

export function countyIsMiamiDade(county: string | undefined): boolean {
  if (!county) return false;
  const value = county.toLowerCase();
  return value.includes("miami-dade") || value.includes("miami dade");
}
