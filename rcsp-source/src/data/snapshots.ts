import type { ParcelFact, SiteFacts } from "../engine/types";

const ring94: number[][][] = [
  [
    [-80.34761132208149, 25.728568941350957],
    [-80.34759923386369, 25.728319660389722],
    [-80.3480175928493, 25.728299844396375],
    [-80.34803183883119, 25.728576291978076],
    [-80.34761263969357, 25.728596122288998],
    [-80.34761132208149, 25.728568941350957],
  ],
];

const ring72: number[][][] = [
  [
    [-80.43865364162765, 25.698489239001866],
    [-80.43915249033815, 25.698477660476073],
    [-80.43917379543133, 25.69899449095686],
    [-80.43874764379702, 25.699004544862582],
    [-80.43874109786833, 25.69900413151291],
    [-80.43872901561079, 25.69900259918535],
    [-80.43871737204672, 25.698999301081376],
    [-80.4387064786068, 25.698994326863218],
    [-80.43869662660059, 25.698987807639504],
    [-80.4386880802255, 25.69897991954895],
    [-80.43868106963498, 25.698970874706703],
    [-80.43867578100907, 25.69896091394479],
    [-80.43867235755941, 25.698950305010413],
    [-80.43867089060895, 25.69893933260207],
    [-80.43865364162765, 25.698489239001866],
  ],
];

interface Snapshot {
  parcel: ParcelFact;
  municipality: string;
  zoningCode: string;
  zoningDescription: string;
  insideUdb: boolean;
  cdmp: string;
}

const snapshots: Record<string, Snapshot> = {
  "4300 SW 94 AVE": {
    parcel: {
      folio: "3040210040761",
      siteAddress: "4300 SW 94 AVE",
      siteCity: "Unincorporated County",
      zip: "33165-0000",
      areaSqFt: 13886.041843383353,
      rings: ring94,
    },
    municipality: "UNINCORPORATED MIAMI-DADE",
    zoningCode: "RU-1",
    zoningDescription: "Single-family Residential District 7,500 ft2 net",
    insideUdb: true,
    cdmp: "LOW DENSITY RESIDENTIAL (LDR) 2.5-6 DU/AC",
  },
  "15200 SW 72 ST": {
    parcel: {
      folio: "3049330400020",
      siteAddress: "15200 SW 72 ST",
      siteCity: "Unincorporated County",
      zip: "33193-0000",
      areaSqFt: 30807.121822219968,
      rings: ring72,
    },
    municipality: "UNINCORPORATED MIAMI-DADE",
    zoningCode: "BU-1A",
    zoningDescription: "Business Districts, limited",
    insideUdb: true,
    cdmp: "BUSINESS AND OFFICE",
  },
};

export function snapshotFacts(normalized: string, base: SiteFacts): SiteFacts | null {
  const snap = snapshots[normalized];
  if (!snap) return null;
  return {
    ...base,
    scope: "miami-dade",
    parcel: snap.parcel,
    parcelNote:
      "Live county GIS did not respond. The folio, area, and outline are a snapshot queried on October 25, 2026. They are not a live county record and not a survey.",
    municipality: snap.municipality,
    unincorporated: true,
    zoning: { code: snap.zoningCode, description: snap.zoningDescription, munc: "30" },
    zoningAreas: [snap.zoningCode],
    zoningNote: "Zone code is from the October 25, 2026 snapshot of the county zone layer, not a live query.",
    insideUdb: snap.insideUdb,
    cdmpDescriptions: [snap.cdmp],
    dataOrigin: "snapshot",
  };
}
