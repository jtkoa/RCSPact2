export interface SourceRecord {
  id: string;
  title: string;
  url: string;
  publisher: string;
  retrieved: "2026-10-25";
  note: string;
}

export const sources = {
  statute: {
    id: "fl-163-31771",
    title: "2026 Florida Statutes § 163.31771, Accessory dwelling units",
    url: "https://www.flsenate.gov/Laws/Statutes/2026/163.31771",
    publisher: "The Florida Senate",
    retrieved: "2026-10-25",
    note: "Opened the Florida Senate display of the 2026 statute. It defines an accessory dwelling unit, says a local government may adopt an ordinance allowing them in single-family areas, and says a building-permit application must include an affordable-rent affidavit. It does not approve a parcel.",
  },
  code: {
    id: "mdc-33-22",
    title: "Miami-Dade County Code of Ordinances § 33-22, Accessory units",
    url: "https://library.municode.com/fl/miami_-_dade_county/codes/code_of_ordinances?nodeId=PTIIICOOR_CH33ZO_ARTIINGE_S33-22ACUN",
    publisher: "Municode (Miami-Dade County Code)",
    retrieved: "2026-10-25",
    note: "Section text was retrieved from Municode. The library banner said the code was codified through Ordinance No. 26-59, enacted July 21, 2026 (Supp. No. 136), and that the site may not reflect the most current legislation. Numeric lot size and floor area in § 33-22(4)(a) are incorporated from the CDMP rather than stated as figures in that subsection.",
  },
  aduPage: {
    id: "mdc-adu-page",
    title: "Miami-Dade County — Accessory Dwelling Units or Guesthouses",
    url: "https://www.miamidade.gov/global/economy/building/accessory-dwelling-unit-adu.page",
    publisher: "Miami-Dade County",
    retrieved: "2026-10-25",
    note: "County guidance page. It states a 7,500 square foot lot minimum, a 400–800 square foot dwelling size in RU-1 districts, and points readers to § 33-22. It is the County's public summary, not a substitute for the ordinance.",
  },
  memo: {
    id: "mdc-memo-221819",
    title: "County Attorney memorandum, Legislative Matter 221819 (2022)",
    url: "https://www.miamidade.gov/govaction/legistarfiles/Matters/Y2022/221819.pdf",
    publisher: "Miami-Dade County",
    retrieved: "2026-10-25",
    note: "Subject line: ordinance pertaining to zoning in the unincorporated area, amending sections including 33-22. The memo quotes the CDMP as authorizing accessory units of 400 to 800 square feet of habitable area on single-family lots of at least 7,500 square feet inside the Urban Development Boundary. It also said a CDMP amendment lowering those figures was under analysis. This screen did not open the CDMP volume itself, and did not confirm that later amendment.",
  },
  geoProperty: {
    id: "gis-geoproperty",
    title: "Miami-Dade GeoProperty address service",
    url: "https://gisws.miamidade.gov/gisaddress/GeoProperty.asmx",
    publisher: "Miami-Dade County GIS",
    retrieved: "2026-10-25",
    note: "Operation GeoProperty returns one ArrLprop, or an empty record with house number 0 when it finds nothing. It does not return a list of candidates. No API key. A returned zone code is not a zoning approval.",
  },
  primaryZone: {
    id: "gis-primary-zone",
    title: "Miami-Dade GIS primary zone (Property Search MapServer layer 9)",
    url: "https://gisfs.miamidade.gov/mdarcgis/rest/services/MD_PA_PropertySearch/MapServer/9",
    publisher: "Miami-Dade County GIS",
    retrieved: "2026-10-25",
    note: "PZDESC is a map description such as a single-family label. It is not a zoning-district code and it is not accessory-unit eligibility.",
  },
  parcelLayer: {
    id: "gis-parcel",
    title: "Miami-Dade GIS parcel layer (Land Management MapServer layer 3)",
    url: "https://gis.miamidade.gov/arcgis/rest/services/LandManagement/MD_ZoningLandManagementData/MapServer/3",
    publisher: "Miami-Dade County GIS",
    retrieved: "2026-10-25",
    note: "Public layer, no API key. Folio, site address, city, ZIP, and Shape.STArea() in the layer's foot unit. Not a boundary survey.",
  },
  muniLayer: {
    id: "gis-muni",
    title: "Miami-Dade GIS municipalities layer (Land Management MapServer layer 7)",
    url: "https://gis.miamidade.gov/arcgis/rest/services/LandManagement/MD_ZoningLandManagementData/MapServer/7",
    publisher: "Miami-Dade County GIS",
    retrieved: "2026-10-25",
    note: "NAME field classifies a point as a municipality or as unincorporated Miami-Dade. A map hit is not a legal boundary opinion.",
  },
  zoneLayer: {
    id: "gis-zone",
    title: "Miami-Dade GIS zone polygons (Property Search MapServer layer 4, MDC.Zone_poly_U)",
    url: "https://gisfs.miamidade.gov/mdarcgis/rest/services/MD_PA_PropertySearch/MapServer/4",
    publisher: "Miami-Dade County GIS",
    retrieved: "2026-10-25",
    note: "Returns ZONE and ZONE_DESC. Used for unincorporated zoning codes such as RU-1 and BU-1A. Not a zoning determination.",
  },
  cityZoneLayer: {
    id: "gis-city-zone",
    title: "Miami-Dade GIS municipal zoning (MD_Zoning MapServer layer 2)",
    url: "https://gis.miamidade.gov/arcgis/rest/services/LandManagement/MD_Zoning/MapServer/2",
    publisher: "Miami-Dade County GIS",
    retrieved: "2026-10-25",
    note: "Shows a municipal zone code where the layer has one. This screen did not retrieve the municipal ordinance that interprets that code. A value of NONE on the unincorporated placeholder is ignored.",
  },
  udbLayer: {
    id: "gis-udb",
    title: "Miami-Dade GIS Urban Development layer (Property Search MapServer layer 17)",
    url: "https://gisfs.miamidade.gov/mdarcgis/rest/services/MD_PA_PropertySearch/MapServer/17",
    publisher: "Miami-Dade County GIS",
    retrieved: "2026-10-25",
    note: "Layer description says that since a 2011 revision the shape presents only the area included in the Urban Development Boundary. A point that intersects the polygon is treated as inside that mapped boundary.",
  },
  cdmpLayer: {
    id: "gis-cdmp",
    title: "Miami-Dade GIS CDMP layer (Land Management MapServer layer 11)",
    url: "https://gis.miamidade.gov/arcgis/rest/services/LandManagement/MD_ZoningLandManagementData/MapServer/11",
    publisher: "Miami-Dade County GIS",
    retrieved: "2026-10-25",
    note: "DESCRIPTION is shown as map context only. It is not used as the zoning district and it is not the CDMP policy text.",
  },
} satisfies Record<string, SourceRecord>;

export type SourceId = (typeof sources)[keyof typeof sources]["id"];

const byId = new Map<string, SourceRecord>(Object.values(sources).map((source) => [source.id, source]));

export function sourceById(id: string): SourceRecord | undefined {
  return byId.get(id);
}

export const LOT_MIN_SQFT = 7500;
