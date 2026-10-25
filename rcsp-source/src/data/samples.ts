export interface SampleProperty {
  id: string;
  titleKey: "sample.one.title" | "sample.two.title";
  summaryKey: "sample.one.summary" | "sample.two.summary";
  address: string;
  folio: string;
  standardizedAddress: string;
}

export const propertySearchUrl = "https://www.miamidadepa.gov/pa/real-estate/property-search.page";

// Confirmed from Miami-Dade GeoProperty, the municipality layer, the zone layer,
// and the parcel layer on October 25, 2026. Opening an example runs the lookup again.
export const samples: SampleProperty[] = [
  {
    id: "sw-94-ave",
    titleKey: "sample.one.title",
    summaryKey: "sample.one.summary",
    address: "4300 SW 94 AVE",
    folio: "3040210040761",
    standardizedAddress: "4300 SW 94TH AVE",
  },
  {
    id: "sw-102-ave",
    titleKey: "sample.two.title",
    summaryKey: "sample.two.summary",
    address: "5401 SW 102 AVE",
    folio: "3040200055370",
    standardizedAddress: "5401 SW 102ND AVE",
  },
];

export function sampleById(id: string): SampleProperty | undefined {
  return samples.find((sample) => sample.id === id);
}
